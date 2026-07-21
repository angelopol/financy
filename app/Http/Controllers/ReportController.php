<?php

namespace App\Http\Controllers;

use App\Models\Earning;
use App\Models\Expense;
use App\Support\ProjectFinanceContext;
use App\Support\SlugNormalizer;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function earnings(Request $request, ProjectFinanceContext $projectFinance)
    {
        $this->authorize('viewAny', Earning::class);
        $from = $request->query('from');
        $to = $request->query('to');
        $provider = $request->query('provider');
        $keywords = $request->query('q', '');

        $query = $projectFinance->apply(Earning::query(), $request)->whereNull('term')->whereNull('claim_day');

        if ($from) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $query->whereDate('created_at', '<=', $to);
        }
        if ($provider && in_array($provider, ['savings', 'box'])) {
            $query->where('provider', $provider);
        }
        $this->applyKeywords($query, $keywords);

        // Compute total BEFORE pagination to avoid any limit/offset effects
        $totalAmount = (clone $query)->sum('amount');
        // Then fetch paginated items using a fresh clone
        $items = (clone $query)->latest()->paginate(15)->withQueryString();
        // Fetch full list for printing (PDF)
        $itemsAll = (clone $query)->latest()->get();

        return Inertia::render('Reports/EarningsReport', [
            'auth' => auth()->user(),
            'rates' => EarningsController::GetRates(),
            'items' => $items,
            'from' => $from,
            'to' => $to,
            'provider' => $provider,
            'keywords' => $keywords,
            'projectId' => $projectFinance->id($request),
            'totalAmount' => $totalAmount,
            'itemsAll' => $itemsAll,
        ]);
    }

    public function expenses(Request $request, ProjectFinanceContext $projectFinance)
    {
        $this->authorize('viewAny', Expense::class);
        $from = $request->query('from');
        $to = $request->query('to');
        $provider = $request->query('provider');
        $keywords = $request->query('q', '');

        $query = $projectFinance->apply(Expense::query(), $request)->whereNull('term')->whereNull('claim_day');

        if ($from) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $query->whereDate('created_at', '<=', $to);
        }
        if ($provider && in_array($provider, ['savings', 'box'])) {
            $query->where('provider', $provider);
        }
        $this->applyKeywords($query, $keywords);

        // Compute total BEFORE pagination to avoid any limit/offset effects
        $totalAmount = (clone $query)->sum('amount');
        // Then fetch paginated items using a fresh clone
        $items = (clone $query)->latest()->paginate(15)->withQueryString();
        // Fetch full list for printing (PDF)
        $itemsAll = (clone $query)->latest()->get();

        return Inertia::render('Reports/ExpensesReport', [
            'auth' => auth()->user(),
            'rates' => EarningsController::GetRates(),
            'items' => $items,
            'from' => $from,
            'to' => $to,
            'provider' => $provider,
            'keywords' => $keywords,
            'projectId' => $projectFinance->id($request),
            'totalAmount' => $totalAmount,
            'itemsAll' => $itemsAll,
        ]);
    }

    public function earningsCsv(Request $request, ProjectFinanceContext $projectFinance): StreamedResponse
    {
        $this->authorize('viewAny', Earning::class);
        $from = $request->query('from');
        $to = $request->query('to');
        $provider = $request->query('provider');
        $keywords = $request->query('q', '');
        $query = $projectFinance->apply(Earning::query(), $request)->whereNull('term')->whereNull('claim_day');
        if ($from) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $query->whereDate('created_at', '<=', $to);
        }
        if ($provider && in_array($provider, ['savings', 'box'])) {
            $query->where('provider', $provider);
        }
        $this->applyKeywords($query, $keywords);
        $items = $query->latest()->get();

        $suffix = ($from || $to || $provider) ? ('_'.($from ?: 'inicio').'_a_'.($to ?: 'hoy').($provider ? ('_'.$provider) : '')) : '';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="earnings_report'.$suffix.'.csv"',
        ];

        $columns = ['id', 'description', 'slug', 'amount', 'currency', 'provider', 'created_at'];

        $currencyLabel = function ($c) {
            return match ($c) {
                '$' => 'Dollar',
                'bs' => 'Bolivares',
                '$bcv' => 'Dollars in bolivares indexed in BCV',
                '$parallel' => 'Dollars in bolivares indexed in parallel tase',
                '€' => 'Euro',
                default => $c,
            };
        };

        $providerLabel = function ($p) {
            $p = strtolower((string) $p);

            return match ($p) {
                'savings' => 'Savings',
                'box' => 'Box',
                default => $p,
            };
        };

        $callback = function () use ($items, $columns, $currencyLabel, $providerLabel) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $columns);
            foreach ($items as $row) {
                fputcsv($handle, [
                    $row->id,
                    $row->description,
                    $row->slug,
                    $row->amount,
                    // Expenses do not persist currency; default to Dollar
                    $currencyLabel($row->currency ?? '$'),
                    $providerLabel($row->provider),
                    optional($row->created_at)->toDateTimeString(),
                ]);
            }
            fclose($handle);
        };

        return response()->stream($callback, 200, $headers);
    }

    public function expensesCsv(Request $request, ProjectFinanceContext $projectFinance): StreamedResponse
    {
        $this->authorize('viewAny', Expense::class);
        $from = $request->query('from');
        $to = $request->query('to');
        $provider = $request->query('provider');
        $keywords = $request->query('q', '');
        $query = $projectFinance->apply(Expense::query(), $request)->whereNull('term')->whereNull('claim_day');
        if ($from) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $query->whereDate('created_at', '<=', $to);
        }
        if ($provider && in_array($provider, ['savings', 'box'])) {
            $query->where('provider', $provider);
        }
        $this->applyKeywords($query, $keywords);
        $items = $query->latest()->get();

        $suffix = ($from || $to || $provider) ? ('_'.($from ?: 'inicio').'_a_'.($to ?: 'hoy').($provider ? ('_'.$provider) : '')) : '';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="expenses_report'.$suffix.'.csv"',
        ];

        $columns = ['id', 'description', 'slug', 'amount', 'currency', 'provider', 'created_at'];

        $currencyLabel = function ($c) {
            return match ($c) {
                '$' => 'Dollar',
                'bs' => 'Bolivares',
                '$bcv' => 'Dollars in bolivares indexed in BCV',
                '$parallel' => 'Dollars in bolivares indexed in parallel tase',
                '€' => 'Euro',
                default => $c,
            };
        };

        $providerLabel = function ($p) {
            $p = strtolower((string) $p);

            return match ($p) {
                'savings' => 'Savings',
                'box' => 'Box',
                default => $p,
            };
        };

        $callback = function () use ($items, $columns, $currencyLabel, $providerLabel) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $columns);
            foreach ($items as $row) {
                fputcsv($handle, [
                    $row->id,
                    $row->description,
                    $row->slug,
                    $row->amount,
                    $currencyLabel($row->currency ?? '$'),
                    $providerLabel($row->provider),
                    optional($row->created_at)->toDateTimeString(),
                ]);
            }
            fclose($handle);
        };

        return response()->stream($callback, 200, $headers);
    }

    private function applyKeywords($query, string $keywords): void
    {
        if (trim($keywords) === '') {
            return;
        }
        $words = SlugNormalizer::words($keywords);
        $query->where(function ($query) use ($keywords, $words) {
            $query->whereRaw('LOWER(description) LIKE ?', ['%'.mb_strtolower($keywords).'%']);
            foreach ($words as $word) {
                $query->orWhereRaw('LOWER(COALESCE(slug, \'\')) LIKE ?', ['%'.$word.'%']);
            }
        });
    }
}
