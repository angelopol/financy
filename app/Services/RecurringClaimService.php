<?php

namespace App\Services;

use App\Models\Earning;
use App\Models\Expense;
use App\Models\Movement;
use Illuminate\Support\Facades\DB;

class RecurringClaimService
{
    public function __construct(
        private FinanceAccountService $accounts,
        private ExchangeRateService $rates,
        private RecurringSchedule $schedule,
    ) {}

    public function earning(Earning $earning): Earning
    {
        return DB::transaction(function () use ($earning) {
            $earning = Earning::lockForUpdate()->findOrFail($earning->id);
            $amount = $this->rates->toDollars($earning->currency, (float) $earning->amount);
            $provider = $earning->provider;
            if ($earning->project_id === null) {
                $provider = $this->accounts->credit((int) $earning->user, $provider, $amount);
            }

            $history = Earning::create([
                'user' => $earning->user,
                'project_id' => $earning->project_id,
                'recurring_id' => $earning->id,
                'description' => $earning->description,
                'slug' => $earning->slug,
                'amount' => $amount,
                'currency' => '$',
                'provider' => $provider,
                'OneTimeTase' => $earning->currency === '$' ? null : $this->rates->get()['parallel'],
            ]);
            $this->movement($history, 'earning');
            $this->schedule->advance($earning);

            return $history;
        });
    }

    public function expense(Expense $expense): Expense
    {
        return DB::transaction(function () use ($expense) {
            $expense = Expense::lockForUpdate()->findOrFail($expense->id);
            $provider = $expense->provider;
            if ($expense->project_id === null) {
                $provider = $this->accounts->debit((int) $expense->user, $provider, (float) $expense->amount);
            }

            $history = Expense::create([
                'user' => $expense->user,
                'project_id' => $expense->project_id,
                'recurring_id' => $expense->id,
                'description' => $expense->description,
                'slug' => $expense->slug,
                'amount' => $expense->amount,
                'provider' => $provider,
            ]);
            $this->movement($history, 'expense');
            $this->schedule->advance($expense);

            return $history;
        });
    }

    private function movement(Earning|Expense $item, string $type): void
    {
        Movement::create([
            'user' => $item->user,
            'project_id' => $item->project_id,
            'type' => $type,
            'reference_id' => $item->id,
            'description' => $item->description,
            'amount' => $item->amount,
            'provider' => $item->provider,
        ]);
    }
}
