<?php

namespace Idealo\FinancyCore\Services;

use InvalidArgumentException;

class SplitExpense
{
    public function equalSplitAmounts(float $amount, array $userIds): array
    {
        if ($userIds === []) {
            throw new InvalidArgumentException('At least one user is required to split an expense.');
        }

        $amountInCents = (int) round($amount * 100);
        $baseAmount = intdiv($amountInCents, count($userIds));
        $remainder = $amountInCents % count($userIds);

        return collect(array_values($userIds))->map(function ($userId, $index) use ($baseAmount, $remainder) {
            $splitAmount = $baseAmount + ($index < $remainder ? 1 : 0);

            return [
                'user_id' => $userId,
                'amount' => number_format($splitAmount / 100, 2, '.', ''),
            ];
        })->all();
    }

    public function assertFixedSplitsMatch(float $amount, array $splits): void
    {
        $total = collect($splits)->sum(fn (array $split) => (int) round(((float) $split['amount']) * 100));
        $expenseTotal = (int) round($amount * 100);

        if ($total !== $expenseTotal) {
            throw new InvalidArgumentException('Expense split total must match the expense amount.');
        }
    }
}
