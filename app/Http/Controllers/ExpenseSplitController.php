<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Services\SplitExpense;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ExpenseSplitController extends Controller
{
    public function update(Request $request, Expense $expense, SplitExpense $splitExpense)
    {
        $this->authorize('update', $expense);

        $validated = $request->validate([
            'split_mode' => 'required|string|in:equal,fixed',
            'split_user_ids' => 'nullable|array',
            'split_user_ids.*' => 'integer|exists:users,id',
            'splits' => 'nullable|array',
            'splits.*.user_id' => 'required_with:splits|integer|exists:users,id',
            'splits.*.amount' => 'required_with:splits|numeric|min:0',
            'splits.*.paid_amount' => 'nullable|numeric|min:0',
            'splits.*.status' => 'nullable|string|in:pending,paid',
        ]);

        try {
            if ($validated['split_mode'] === 'equal') {
                $splitExpense->equally($expense, $validated['split_user_ids'] ?? []);
            } else {
                $splitExpense->fixed($expense, $validated['splits'] ?? []);
            }
        } catch (\InvalidArgumentException $exception) {
            throw ValidationException::withMessages([
                'splits' => $exception->getMessage(),
            ]);
        }

        return back();
    }
}
