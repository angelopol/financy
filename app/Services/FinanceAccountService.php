<?php

namespace App\Services;

use App\Models\Box;
use App\Models\Saving;

class FinanceAccountService
{
    public function chooseProvider(int $userId): string
    {
        [$box, $saving] = $this->accounts($userId);

        return (float) $box->amount >= (float) $saving->amount ? 'box' : 'savings';
    }

    public function credit(int $userId, string $provider, float $amount): string
    {
        if ($provider === 'auto') {
            $provider = $this->chooseProvider($userId);
        }

        [$box, $saving] = $this->accounts($userId);
        $account = $provider === 'box' ? $box : $saving;
        $account->amount = (float) $account->amount + $amount;
        $account->save();

        return $provider;
    }

    public function debit(int $userId, string $preferred, float $amount): string
    {
        [$box, $saving] = $this->accounts($userId, true);
        if ($preferred === 'auto') {
            $preferred = (float) $box->amount >= (float) $saving->amount ? 'box' : 'savings';
        }

        $primary = $preferred === 'box' ? $box : $saving;
        $secondary = $preferred === 'box' ? $saving : $box;
        $primaryContribution = min((float) $primary->amount, $amount);
        $remaining = max(0, $amount - $primaryContribution);
        $secondaryContribution = min((float) $secondary->amount, $remaining);

        $primary->amount = max(0, (float) $primary->amount - $primaryContribution);
        $secondary->amount = max(0, (float) $secondary->amount - $secondaryContribution);
        $primary->save();
        $secondary->save();

        if ($secondaryContribution > $primaryContribution) {
            return $preferred === 'box' ? 'savings' : 'box';
        }

        return $preferred;
    }

    private function accounts(int $userId, bool $lock = false): array
    {
        $boxQuery = Box::where('user', $userId);
        $savingQuery = Saving::where('user', $userId);
        if ($lock) {
            $boxQuery->lockForUpdate();
            $savingQuery->lockForUpdate();
        }

        $box = $boxQuery->first() ?? Box::create(['user' => $userId, 'amount' => 0]);
        $saving = $savingQuery->first() ?? Saving::create(['user' => $userId, 'amount' => 0]);

        return [$box, $saving];
    }
}
