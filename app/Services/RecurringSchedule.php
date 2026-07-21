<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

class RecurringSchedule
{
    public function dueAt(Model $item): ?Carbon
    {
        if (! $item->UpdatedTerm) {
            return null;
        }

        $anchor = Carbon::parse($item->UpdatedTerm);
        if ($item->recurrence_type === 'monthly' && $item->claim_day) {
            $candidate = $this->dayInMonth($anchor, (int) $item->claim_day);
            if ($candidate->lessThanOrEqualTo($anchor)) {
                $candidate = $this->dayInMonth($anchor->copy()->addMonthNoOverflow()->startOfMonth(), (int) $item->claim_day);
            }

            return $candidate;
        }

        return $item->NextClaim === null ? null : $anchor->copy()->addDays((int) $item->NextClaim);
    }

    public function advance(Model $item, ?Carbon $claimedAt = null): void
    {
        $claimedAt ??= now();
        $item->UpdatedTerm = $claimedAt;
        $item->NextClaim = $item->recurrence_type === 'monthly' ? null : $item->term;
        $item->save();
    }

    public function monthlyMultiplier(Model $item): int
    {
        if ($item->recurrence_type === 'monthly' || $item->claim_day) {
            return 1;
        }

        return (int) $item->term <= 22 ? 2 : 1;
    }

    private function dayInMonth(Carbon $month, int $day): Carbon
    {
        $date = $month->copy()->startOfMonth();

        return $date->day(min($day, $date->daysInMonth))->startOfDay();
    }
}
