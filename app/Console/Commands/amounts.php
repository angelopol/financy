<?php

namespace App\Console\Commands;

use App\Models\Earning;
use App\Models\Expense;
use App\Services\RecurringClaimService;
use App\Services\RecurringSchedule;
use Illuminate\Console\Command;

class amounts extends Command
{
    protected $signature = 'amounts:cron';

    protected $description = 'Claim due automatic recurring earnings and expenses.';

    public function handle(RecurringSchedule $schedule, RecurringClaimService $claims): int
    {
        $now = now();
        $earnings = Earning::where('auto_claim', true)
            ->where(fn ($q) => $q->whereNotNull('term')->orWhereNotNull('claim_day'))
            ->get()->filter(fn ($item) => $schedule->dueAt($item)?->lessThanOrEqualTo($now));
        $expenses = Expense::where('auto_claim', true)
            ->where(fn ($q) => $q->whereNotNull('term')->orWhereNotNull('claim_day'))
            ->get()->filter(fn ($item) => $schedule->dueAt($item)?->lessThanOrEqualTo($now));

        $earnings->each(fn ($earning) => $claims->earning($earning));
        $expenses->each(fn ($expense) => $claims->expense($expense));
        $this->info("Claimed {$earnings->count()} earnings and {$expenses->count()} expenses.");

        return self::SUCCESS;
    }
}
