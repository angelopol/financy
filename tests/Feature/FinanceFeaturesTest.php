<?php

namespace Tests\Feature;

use App\Models\Box;
use App\Models\Earning;
use App\Models\Expense;
use App\Models\Movement;
use App\Models\Saving;
use App\Models\ShopListItem;
use App\Models\User;
use App\Notifications\RecurringEarningReminder;
use App\Services\RecurringSchedule;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FinanceFeaturesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::put('financy.exchange-rates', ['parallel' => 40, 'bcv' => 36, 'euro' => 44, 'euro_parallel' => 48]);
    }

    public function test_manual_claim_creates_history_movement_and_updates_balance(): void
    {
        $user = $this->financeUser();
        $earning = Earning::create([
            'user' => $user->id, 'description' => 'Biweekly salary', 'slug' => 'biweekly salary',
            'amount' => 100, 'currency' => '$', 'provider' => 'box', 'term' => 15,
            'NextClaim' => 15, 'UpdatedTerm' => now(), 'recurrence_type' => 'days', 'auto_claim' => false,
        ]);

        $this->actingAs($user)->post(route('earnings.claim', $earning))->assertSessionHasNoErrors();

        $history = Earning::where('recurring_id', $earning->id)->first();
        $this->assertNotNull($history);
        $this->assertSame('biweekly salary', $history->slug);
        $this->assertEquals(100, Box::where('user', $user->id)->value('amount'));
        $this->assertTrue(Movement::where('type', 'earning')->where('reference_id', $history->id)->exists());
    }

    public function test_day_31_uses_last_day_of_short_month(): void
    {
        Carbon::setTestNow('2027-01-31 12:00:00');
        $earning = new Earning([
            'UpdatedTerm' => now(), 'claim_day' => 31, 'recurrence_type' => 'monthly',
        ]);

        $this->assertSame('2027-02-28', app(RecurringSchedule::class)->dueAt($earning)->toDateString());
        Carbon::setTestNow();
    }

    public function test_cron_respects_manual_only_recurring_items(): void
    {
        $user = $this->financeUser();
        foreach ([true, false] as $automatic) {
            Earning::create([
                'user' => $user->id, 'description' => $automatic ? 'Automatic' : 'Manual', 'amount' => 10,
                'currency' => '$', 'provider' => 'box', 'term' => 15, 'NextClaim' => 1,
                'UpdatedTerm' => now()->subDays(2), 'recurrence_type' => 'days', 'auto_claim' => $automatic,
            ]);
        }

        $this->artisan('amounts:cron')->assertSuccessful();

        $this->assertSame(1, Earning::whereNotNull('recurring_id')->count());
        $this->assertEquals(10, Box::where('user', $user->id)->value('amount'));
    }

    public function test_purchase_not_discount_does_not_touch_balances_or_create_expense(): void
    {
        $user = $this->financeUser(75, 25);
        $item = ShopListItem::create(['user' => $user->id, 'description' => 'Registered item', 'amount' => 20, 'status' => 'pending']);

        $this->actingAs($user)->post(route('shoplist.purchased', $item), [
            'provider' => 'auto', 'amount' => 20, 'not_discount' => true,
        ])->assertSessionHasNoErrors();

        $this->assertEquals(75, Box::where('user', $user->id)->value('amount'));
        $this->assertEquals(25, Saving::where('user', $user->id)->value('amount'));
        $this->assertFalse(Expense::where('shop_list_item_id', $item->id)->exists());
        $this->assertTrue($item->refresh()->not_discount);
    }

    public function test_verified_user_gets_one_reminder_for_tomorrows_claim(): void
    {
        Notification::fake();
        $user = $this->financeUser();
        Earning::create([
            'user' => $user->id, 'description' => 'Salary reminder', 'amount' => 10, 'currency' => '$',
            'provider' => 'box', 'term' => 2, 'NextClaim' => 2, 'UpdatedTerm' => now()->subDay(),
            'recurrence_type' => 'days', 'auto_claim' => false,
        ]);

        $this->artisan('earnings:send-reminders')->assertSuccessful();
        $this->artisan('earnings:send-reminders')->assertSuccessful();

        Notification::assertSentToTimes($user, RecurringEarningReminder::class, 1);
    }

    public function test_automatic_provider_uses_both_accounts_and_records_largest_contributor(): void
    {
        $user = $this->financeUser(40, 100);

        $this->actingAs($user)->post(route('expenses.store'), [
            'description' => 'Large grocery purchase', 'amount' => 120, 'currency' => '$',
            'provider' => 'auto', 'recurrence_type' => 'one_time',
        ])->assertSessionHasNoErrors();

        $expense = Expense::firstOrFail();
        $this->assertSame('savings', $expense->provider);
        $this->assertSame('large grocery purchase', $expense->slug);
        $this->assertEquals(20, Box::where('user', $user->id)->value('amount'));
        $this->assertEquals(0, Saving::where('user', $user->id)->value('amount'));
    }

    public function test_expense_limit_returns_warning_after_seventy_percent(): void
    {
        $user = $this->financeUser(100);
        $user->update(['monthly_expense_limit' => 100]);

        $this->actingAs($user)->post(route('expenses.store'), [
            'description' => 'Monthly shopping', 'amount' => 75, 'currency' => '$',
            'provider' => 'box', 'recurrence_type' => 'one_time',
        ])->assertSessionHas('flash.type', 'warning');
    }

    public function test_recurring_totals_double_cycles_up_to_twenty_two_days(): void
    {
        $user = $this->financeUser();
        foreach ([[15, 10], [23, 20]] as [$term, $amount]) {
            Expense::create([
                'user' => $user->id, 'description' => "Cycle {$term}", 'amount' => $amount,
                'provider' => 'box', 'term' => $term, 'NextClaim' => $term,
                'UpdatedTerm' => now(), 'recurrence_type' => 'days',
            ]);
        }

        $this->actingAs($user)->get(route('expenses.index'))->assertInertia(fn (Assert $page) => $page
            ->where('recurringTotals.every15Days', 30)
            ->where('recurringTotals.monthly', 40)
        );
    }

    public function test_budget_category_subtracts_expenses_with_shared_keywords(): void
    {
        $user = $this->financeUser(100);
        Expense::create([
            'user' => $user->id, 'description' => 'Fresh food', 'slug' => 'fresh food market',
            'amount' => 25, 'provider' => 'box', 'recurrence_type' => 'one_time',
        ]);
        $this->actingAs($user)->post(route('budgets.categories.store'), [
            'month' => now()->format('Y-m'), 'name' => 'Groceries', 'amount' => 100, 'slug' => ['food'],
        ])->assertSessionHasNoErrors();

        $this->actingAs($user)->get(route('budgets.index'))->assertInertia(fn (Assert $page) => $page
            ->where('categories.0.spent', 25)
            ->where('categories.0.remaining', 75)
        );
    }

    private function financeUser(float $box = 0, float $savings = 0): User
    {
        $user = User::factory()->create();
        Box::create(['user' => $user->id, 'amount' => $box]);
        Saving::create(['user' => $user->id, 'amount' => $savings]);

        return $user;
    }
}
