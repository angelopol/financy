<?php

namespace App\Console\Commands;

use App\Models\Earning;
use App\Notifications\RecurringEarningReminder;
use App\Services\RecurringSchedule;
use Illuminate\Console\Command;

class SendRecurringEarningReminders extends Command
{
    protected $signature = 'earnings:send-reminders';

    protected $description = 'Email verified users one day before recurring earnings are due.';

    public function handle(RecurringSchedule $schedule): int
    {
        $tomorrow = now()->addDay();
        $sent = 0;
        Earning::query()
            ->where(fn ($q) => $q->whereNotNull('term')->orWhereNotNull('claim_day'))
            ->get()
            ->each(function (Earning $earning) use ($schedule, $tomorrow, &$sent) {
                $dueAt = $schedule->dueAt($earning);
                $user = $earning->user()->first();
                if (! $dueAt?->isSameDay($tomorrow) || ! $user?->hasVerifiedEmail()) {
                    return;
                }
                if ($earning->last_notified_claim_at?->isSameDay($dueAt)) {
                    return;
                }
                $user->notify(new RecurringEarningReminder($earning, $dueAt));
                $earning->update(['last_notified_claim_at' => $dueAt]);
                $sent++;
            });
        $this->info("Sent {$sent} recurring earning reminders.");

        return self::SUCCESS;
    }
}
