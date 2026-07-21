<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\Movement;
use App\Services\ExchangeRateService;
use App\Services\FinanceAccountService;
use App\Services\RecurringClaimService;
use App\Services\RecurringSchedule;
use App\Support\ProjectFinanceContext;
use App\Support\SlugNormalizer;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ExpensesController extends Controller
{
    public static function SubtractProvider($provider, $otherProvider, $amount): void
    {
        app(FinanceAccountService::class)->debit((int) $provider->user, $provider instanceof \App\Models\Box ? 'box' : 'savings', (float) $amount);
    }

    public function index(Request $request, ProjectFinanceContext $context, RecurringSchedule $schedule)
    {
        $base = $context->apply(Expense::query(), $request);
        $this->search($base, $request->string('q')->toString());
        $recurring = (clone $base)->where(fn ($q) => $q->whereNotNull('term')->orWhereNotNull('claim_day'));
        $oneTime = (clone $base)->whereNull('term')->whereNull('claim_day');
        $items = (clone $recurring)->get();

        return Inertia::render('Expenses/Expenses', [
            'auth' => auth()->user(),
            'projectId' => $context->id($request),
            'RecurringExpenses' => $recurring->latest()->paginate(5, ['*'], 'recurring_page')->withQueryString(),
            'OneTimeExpenses' => $oneTime->latest()->paginate(5, ['*'], 'history_page')->withQueryString(),
            'rates' => EarningsController::GetRates(),
            'filters' => ['q' => $request->string('q')->toString()],
            'recurringTotals' => [
                'every15Days' => round($items->sum('amount'), 2),
                'monthly' => round($items->sum(fn ($item) => (float) $item->amount * $schedule->monthlyMultiplier($item)), 2),
            ],
        ]);
    }

    public function store(Request $request, ProjectFinanceContext $context, ExchangeRateService $rates, FinanceAccountService $accounts)
    {
        $request->merge(['recurrence_type' => $request->input('recurrence_type', $request->filled('term') ? 'days' : 'one_time')]);
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0',
            'description' => 'required|string|max:500',
            'slug' => 'nullable|array|max:30',
            'slug.*' => 'string|max:60',
            'currency' => 'required|string|in:$,bs,$bcv,$parallel,€',
            'provider' => 'required|string|in:box,savings,auto',
            'recurrence_type' => 'required|in:one_time,days,monthly',
            'term' => 'nullable|required_if:recurrence_type,days|integer|min:1',
            'claim_day' => 'nullable|required_if:recurrence_type,monthly|integer|min:1|max:31',
            'nextterm' => 'nullable|integer|min:0',
            'auto_claim' => 'nullable|boolean',
            'project_id' => 'nullable|integer|min:1',
        ]);
        $validated['user'] = auth()->id();
        $validated['project_id'] = $context->id($request);
        $validated['slug'] = SlugNormalizer::normalize($validated['slug'] ?? null, $validated['description']);
        $validated['amount'] = $rates->toDollars($validated['currency'], (float) $validated['amount']);
        $validated['auto_claim'] = $request->boolean('auto_claim', true);
        $validated['provider'] = $validated['provider'] === 'auto'
            ? $accounts->chooseProvider(auth()->id())
            : $validated['provider'];
        $isRecurring = $validated['recurrence_type'] !== 'one_time';

        if ($isRecurring) {
            $validated['UpdatedTerm'] = now();
            $validated['term'] = $validated['recurrence_type'] === 'days' ? $validated['term'] : null;
            $validated['claim_day'] = $validated['recurrence_type'] === 'monthly' ? $validated['claim_day'] : null;
            $validated['NextClaim'] = $validated['recurrence_type'] === 'days' ? ($validated['nextterm'] ?? $validated['term']) : null;
        } else {
            if ($validated['project_id'] === null) {
                $validated['provider'] = $accounts->debit(auth()->id(), $validated['provider'], (float) $validated['amount']);
            }
            $validated['recurrence_type'] = 'one_time';
            $validated['term'] = $validated['claim_day'] = $validated['NextClaim'] = null;
        }
        unset($validated['currency'], $validated['nextterm']);
        $expense = Expense::create($validated);
        $this->syncMovement($expense);

        return back()->with('flash', $this->limitFlash($request, 'Expense created.'));
    }

    public function update(Request $request, Expense $expense, ExchangeRateService $rates)
    {
        $this->authorize('update', $expense);
        $validated = $request->validate([
            'amount' => 'sometimes|numeric|min:0',
            'description' => 'sometimes|string|max:500',
            'slug' => 'nullable|array|max:30',
            'slug.*' => 'string|max:60',
            'currency' => 'sometimes|string|in:$,bs,$bcv,$parallel,€',
            'auto_claim' => 'sometimes|boolean',
            'project_id' => 'nullable|integer|min:1',
        ]);
        if (isset($validated['amount'])) {
            $validated['amount'] = $rates->toDollars($validated['currency'] ?? '$', (float) $validated['amount']);
        }
        unset($validated['currency']);
        if (array_key_exists('slug', $validated)) {
            $validated['slug'] = SlugNormalizer::normalize($validated['slug'], $validated['description'] ?? $expense->description);
        }
        $expense->update($validated);
        $this->syncMovement($expense);

        return back()->with('flash', ['type' => 'success', 'message' => 'Expense updated.']);
    }

    public function destroy(Expense $expense, FinanceAccountService $accounts)
    {
        $this->authorize('delete', $expense);
        if ($expense->term === null && $expense->claim_day === null && $expense->project_id === null) {
            $accounts->credit((int) $expense->user, $expense->provider, (float) $expense->amount);
        }
        Movement::where('type', 'expense')->where('reference_id', $expense->id)->delete();
        $expense->delete();

        return back();
    }

    public function claim(Expense $expense, RecurringClaimService $claims)
    {
        $this->authorize('update', $expense);
        abort_unless($expense->term !== null || $expense->claim_day !== null, 422, 'Only recurring expenses can be claimed.');
        $claims->expense($expense);

        return back()->with('flash', $this->limitFlash(request(), 'Expense claimed and added to history.'));
    }

    public static function monthlySpent(int $userId): float
    {
        return (float) Expense::where('user', $userId)->whereNull('project_id')
            ->whereNull('term')->whereNull('claim_day')
            ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->sum('amount');
    }

    public function limitFlash(Request $request, string $createdMessage): array
    {
        $limit = (float) ($request->user()->monthly_expense_limit ?? 0);
        if ($limit <= 0) {
            return ['type' => 'success', 'message' => $createdMessage];
        }
        $percentage = self::monthlySpent($request->user()->id) / $limit * 100;
        if ($percentage >= 100) {
            return ['type' => 'error', 'message' => $createdMessage.' You have exceeded your monthly expense limit.'];
        }
        if ($percentage >= 70) {
            return ['type' => 'warning', 'message' => $createdMessage.' You are close to your monthly expense limit.'];
        }

        return ['type' => 'success', 'message' => $createdMessage];
    }

    private function search($query, string $search): void
    {
        $words = SlugNormalizer::words($search);
        if ($search === '') {
            return;
        }
        $query->where(function ($query) use ($search, $words) {
            $query->whereRaw('LOWER(description) LIKE ?', ['%'.mb_strtolower($search).'%']);
            foreach ($words as $word) {
                $query->orWhereRaw('LOWER(COALESCE(slug, \'\')) LIKE ?', ['%'.$word.'%']);
            }
        });
    }

    private function syncMovement(Expense $expense): void
    {
        Movement::updateOrCreate(
            ['type' => 'expense', 'reference_id' => $expense->id],
            ['user' => $expense->user, 'project_id' => $expense->project_id, 'description' => $expense->description, 'amount' => $expense->amount, 'provider' => $expense->provider]
        );
    }
}
