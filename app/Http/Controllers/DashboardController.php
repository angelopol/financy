<?php

namespace App\Http\Controllers;

use App\Models\Box;
use App\Models\Earning;
use App\Models\Expense;
use App\Models\Saving;
use App\Models\ShopListItem;
use App\Services\ExchangeRateService;
use App\Services\RecurringSchedule;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function __construct(private ExchangeRateService $rates, private RecurringSchedule $schedule) {}

    private function getItems(string $provider, bool $withHistory = true): array
    {
        $earningsQuery = Earning::where('user', auth()->id())->whereNull('project_id')->where('provider', $provider);
        $expensesQuery = Expense::where('user', auth()->id())->whereNull('project_id')->where('provider', $provider);
        $recurringEarnings = (clone $earningsQuery)->where(fn ($q) => $q->whereNotNull('term')->orWhereNotNull('claim_day'));
        $recurringExpenses = (clone $expensesQuery)->where(fn ($q) => $q->whereNotNull('term')->orWhereNotNull('claim_day'));
        $rates = $this->rates->get();
        $monthlyEarnings = $recurringEarnings->get()->sum(fn ($item) => $this->rates->toDollars($item->currency, (float) $item->amount, $rates) * $this->schedule->monthlyMultiplier($item)
        );
        $monthlyExpenses = $recurringExpenses->get()->sum(fn ($item) => (float) $item->amount * $this->schedule->monthlyMultiplier($item)
        );

        return [
            'auth' => auth()->user(),
            'rates' => $rates,
            'RecurringEarnings' => (clone $recurringEarnings)->latest()->paginate(5),
            'OneTimeEarnings' => $withHistory ? (clone $earningsQuery)->whereNull('term')->whereNull('claim_day')->latest()->paginate(3) : null,
            'RecurringExpenses' => (clone $recurringExpenses)->latest()->paginate(5),
            'OneTimeExpenses' => $withHistory ? (clone $expensesQuery)->whereNull('term')->whereNull('claim_day')->latest()->paginate(3) : null,
            'ShopListItems' => $withHistory ? ShopListItem::where('user', auth()->id())->where('provider', $provider)->latest()->paginate(10) : null,
            'ExpectedSavings' => round($monthlyEarnings - $monthlyExpenses, 2),
        ];
    }

    public function ShowDashboard()
    {
        $boxData = $this->getItems('box', false);
        $savingsData = $this->getItems('savings', false);
        $spent = ExpensesController::monthlySpent(auth()->id());
        $limit = (float) (auth()->user()->monthly_expense_limit ?? 0);

        return Inertia::render('Dashboard', [
            'savings' => Saving::firstOrCreate(['user' => auth()->id()], ['amount' => 0])->amount,
            'box' => Box::firstOrCreate(['user' => auth()->id()], ['amount' => 0])->amount,
            'ExpectedBox' => $boxData['ExpectedSavings'],
            'ExpectedSavings' => $savingsData['ExpectedSavings'],
            'auth' => auth()->user(),
            'rates' => $this->rates->get(),
            'expenseLimit' => [
                'limit' => $limit,
                'spent' => round($spent, 2),
                'percentage' => $limit > 0 ? round($spent / $limit * 100, 1) : 0,
            ],
        ]);
    }

    public function ShowSavings()
    {
        return Inertia::render('Savings/Savings', [...$this->getItems('savings'), 'savings' => Saving::where('user', auth()->id())->value('amount')]);
    }

    public function ShowBox()
    {
        return Inertia::render('Box/Box', [...$this->getItems('box'), 'box' => Box::where('user', auth()->id())->value('amount')]);
    }

    public function transfer(Request $request)
    {
        $box = Box::where('user', auth()->id())->firstOrFail();
        $validated = $request->validate(['amount' => 'required|numeric|min:1|max:'.$box->amount]);
        $savings = Saving::firstOrCreate(['user' => auth()->id()], ['amount' => 0]);
        $savings->increment('amount', $validated['amount']);
        $box->decrement('amount', $validated['amount']);

        return redirect()->route('box.show');
    }

    public function transferToSavings(Request $request)
    {
        $savings = Saving::where('user', auth()->id())->firstOrFail();
        $validated = $request->validate(['amount' => 'required|numeric|min:1|max:'.$savings->amount]);
        $box = Box::firstOrCreate(['user' => auth()->id()], ['amount' => 0]);
        $box->increment('amount', $validated['amount']);
        $savings->decrement('amount', $validated['amount']);

        return redirect()->route('savings.show');
    }
}
