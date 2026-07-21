<?php

namespace App\Http\Controllers;

use App\Models\Earning;
use App\Models\Movement;
use App\Services\ExchangeRateService;
use App\Services\FinanceAccountService;
use App\Services\RecurringClaimService;
use App\Services\RecurringSchedule;
use App\Support\ProjectFinanceContext;
use App\Support\SlugNormalizer;
use Illuminate\Http\Request;
use Inertia\Inertia;

class EarningsController extends Controller
{
    public static function GetRates(): array
    {
        return app(ExchangeRateService::class)->get();
    }

    public static function ConvertAmount($currency, $amount, $parallel, $bcv, $euro = null): float
    {
        return app(ExchangeRateService::class)->toDollars((string) $currency, (float) $amount, [
            'parallel' => $parallel,
            'bcv' => $bcv,
            'euro' => $euro ?? $bcv,
        ]);
    }

    public function index(Request $request, ProjectFinanceContext $context, ExchangeRateService $rates, RecurringSchedule $schedule)
    {
        $base = $context->apply(Earning::query(), $request);
        $this->search($base, $request->string('q')->toString());
        $recurring = (clone $base)->where(function ($query) {
            $query->whereNotNull('term')->orWhereNotNull('claim_day');
        });
        $oneTime = (clone $base)->whereNull('term')->whereNull('claim_day');
        $rateValues = $rates->get();
        $totalEvery15Days = 0;
        $totalMonthly = 0;
        foreach ((clone $recurring)->get() as $earning) {
            $amount = $rates->toDollars($earning->currency, (float) $earning->amount, $rateValues);
            $totalEvery15Days += $amount;
            $totalMonthly += $amount * $schedule->monthlyMultiplier($earning);
        }

        return Inertia::render('Earnings/Earnings', [
            'auth' => auth()->user(),
            'projectId' => $context->id($request),
            'RecurringEarnings' => $recurring->latest()->paginate(5, ['*'], 'recurring_page')->withQueryString(),
            'OneTimeEarnings' => $oneTime->latest()->paginate(5, ['*'], 'history_page')->withQueryString(),
            'rates' => $rateValues,
            'filters' => ['q' => $request->string('q')->toString()],
            'recurringTotals' => [
                'every15Days' => round($totalEvery15Days, 2),
                'monthly' => round($totalMonthly, 2),
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
        $validated['auto_claim'] = $request->boolean('auto_claim', true);
        $validated['provider'] = $validated['provider'] === 'auto'
            ? $accounts->chooseProvider(auth()->id())
            : $validated['provider'];
        $isRecurring = $validated['recurrence_type'] !== 'one_time';

        if ($isRecurring) {
            $validated['UpdatedTerm'] = now();
            $validated['term'] = $validated['recurrence_type'] === 'days' ? $validated['term'] : null;
            $validated['claim_day'] = $validated['recurrence_type'] === 'monthly' ? $validated['claim_day'] : null;
            $validated['NextClaim'] = $validated['recurrence_type'] === 'days'
                ? ($validated['nextterm'] ?? $validated['term'])
                : null;
        } else {
            $amount = $rates->toDollars($validated['currency'], (float) $validated['amount']);
            if ($validated['project_id'] === null) {
                $validated['provider'] = $accounts->credit(auth()->id(), $validated['provider'], $amount);
            }
            $validated['amount'] = $amount;
            $validated['OneTimeTase'] = $validated['currency'] === '$' ? null : $rates->get()['parallel'];
            $validated['currency'] = '$';
            $validated['recurrence_type'] = 'one_time';
            $validated['term'] = $validated['claim_day'] = $validated['NextClaim'] = null;
        }
        unset($validated['nextterm']);

        $earning = Earning::create($validated);
        $this->syncMovement($earning);

        return back()->with('flash', ['type' => 'success', 'message' => 'Earning created.']);
    }

    public function update(Request $request, Earning $earning)
    {
        $this->authorize('update', $earning);
        $validated = $request->validate([
            'description' => 'sometimes|string|max:500',
            'slug' => 'nullable|array|max:30',
            'slug.*' => 'string|max:60',
            'amount' => 'sometimes|numeric|min:0',
            'currency' => 'sometimes|string|in:$,bs,$bcv,$parallel,€',
            'auto_claim' => 'sometimes|boolean',
            'project_id' => 'nullable|integer|min:1',
        ]);
        if (array_key_exists('slug', $validated)) {
            $validated['slug'] = SlugNormalizer::normalize($validated['slug'], $validated['description'] ?? $earning->description);
        }
        $earning->update($validated);
        $this->syncMovement($earning);

        return back()->with('flash', ['type' => 'success', 'message' => 'Earning updated.']);
    }

    public function destroy(Earning $earning, FinanceAccountService $accounts)
    {
        $this->authorize('delete', $earning);
        if ($earning->term === null && $earning->claim_day === null && $earning->project_id === null) {
            $accounts->debit((int) $earning->user, $earning->provider, (float) $earning->amount);
        }
        Movement::where('type', 'earning')->where('reference_id', $earning->id)->delete();
        $earning->delete();

        return back();
    }

    public function claim(Earning $earning, RecurringClaimService $claims)
    {
        $this->authorize('update', $earning);
        abort_unless($earning->term !== null || $earning->claim_day !== null, 422, 'Only recurring earnings can be claimed.');
        $claims->earning($earning);

        return back()->with('flash', ['type' => 'success', 'message' => 'Earning claimed and added to history.']);
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

    private function syncMovement(Earning $earning): void
    {
        Movement::updateOrCreate(
            ['type' => 'earning', 'reference_id' => $earning->id],
            ['user' => $earning->user, 'project_id' => $earning->project_id, 'description' => $earning->description, 'amount' => $earning->amount, 'provider' => $earning->provider]
        );
    }
}
