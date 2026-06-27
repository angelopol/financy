<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\ExpenseSplit;
use Illuminate\Support\Collection;
use InvalidArgumentException;

class SplitExpense
{
    public function equally(Expense $expense, array $userIds): Collection
    {
        if ($userIds === []) {
            throw new InvalidArgumentException('At least one user is required to split an expense.');
        }

        $amountInCents = (int) round(((float) $expense->amount) * 100);
        $baseAmount = intdiv($amountInCents, count($userIds));
        $remainder = $amountInCents % count($userIds);

        $splits = [];

        foreach (array_values($userIds) as $index => $userId) {
            $splitAmount = $baseAmount + ($index < $remainder ? 1 : 0);

            $splits[] = [
                'user_id' => $userId,
                'amount' => number_format($splitAmount / 100, 2, '.', ''),
            ];
        }

        return $this->fixed($expense, $splits);
    }

    public function fixed(Expense $expense, array $splits): Collection
    {
        $total = collect($splits)->sum(fn (array $split) => (int) round(((float) $split['amount']) * 100));
        $expenseTotal = (int) round(((float) $expense->amount) * 100);

        if ($total !== $expenseTotal) {
            throw new InvalidArgumentException('Expense split total must match the expense amount.');
        }

        $expense->splits()->delete();

        return collect($splits)->map(fn (array $split) => $expense->splits()->create([
            'user_id' => $split['user_id'],
            'amount' => $split['amount'],
            'paid_amount' => $split['paid_amount'] ?? 0,
            'status' => $split['status'] ?? ExpenseSplit::STATUS_PENDING,
        ]));
    }
}
