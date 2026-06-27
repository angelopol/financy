<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Box;
use App\Models\Saving;
use App\Models\Expense;
use App\Models\Movement;
use App\Services\SplitExpense;
use App\Support\ProjectFinanceContext;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class ExpensesController extends Controller
{
    public static function SubtractProvider($provider, $otherProvider, $amount){
        $provider->amount -= $amount;
        if ($provider->amount < 0) {
            $deficit = abs($provider->amount);
            if ($otherProvider->amount >= $deficit) {
                $otherProvider->amount -= $deficit;
                $provider->amount = 0;
            } else {
                $provider->amount += $otherProvider->amount;
                $otherProvider->amount = 0;
            }
            $otherProvider->save();
        }
        $provider->save();
    }
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request, ProjectFinanceContext $projectFinance)
    {
        $baseQuery = $projectFinance->apply(Expense::query(), $request)->with('splits');

        return Inertia::render('Expenses/Expenses', [
            'auth' => auth()->user(),
            'projectId' => $projectFinance->id($request),
            'RecurringExpenses' => (clone $baseQuery)->where('term', '!=', null)->latest()->paginate(5),
            'OneTimeExpenses' => (clone $baseQuery)->where('term', null)->latest()->paginate(3),
            'rates' => EarningsController::GetRates()
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request, ProjectFinanceContext $projectFinance, SplitExpense $splitExpense)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric',
            'description' => 'required|string|max:500',
            'currency' => 'required|string|in:$,bs,$bcv',
            'provider' => 'required|string|in:box,savings',
            'term' => 'nullable|numeric|min:1',
            'nextterm' => 'nullable|numeric',
            'project_id' => 'nullable|integer|min:1',
            'split_mode' => 'nullable|string|in:none,equal,fixed',
            'split_user_ids' => 'nullable|array',
            'split_user_ids.*' => 'integer|exists:users,id',
            'splits' => 'nullable|array',
            'splits.*.user_id' => 'required_with:splits|integer|exists:users,id',
            'splits.*.amount' => 'required_with:splits|numeric|min:0',
            'splits.*.paid_amount' => 'nullable|numeric|min:0',
            'splits.*.status' => 'nullable|string|in:pending,paid',
        ]);

        $rates = EarningsController::GetRates();
        $parallel = $rates['parallel'];
        $bcv = $rates['bcv'];

        $validated['user'] = auth()->id();
        $validated['project_id'] = $projectFinance->id($request);
        $validated['amount'] = EarningsController::ConvertAmount($validated['currency'], $validated['amount'], $parallel, $bcv);

        if(isset($validated['term'])){
            $validated['UpdatedTerm'] = now();
        } elseif ($validated['project_id'] === null) {
            if ($validated['provider'] == 'box') {
                $provider = Box::where('user', auth()->id())->first();
                $otherProvider = Saving::where('user', auth()->id())->first();
            } else {
                $provider = Saving::where('user', auth()->id())->first();
                $otherProvider = Box::where('user', auth()->id())->first();
            }
            $this::SubtractProvider($provider, $otherProvider, $validated['amount']);
        }

        if(isset($validated['nextterm'])){
            $validated['NextClaim'] = $validated['nextterm'];
        } else {
            $validated['NextClaim'] = $validated['term'];
        }

        $expense = $request->user()->expenses()->create($validated);

        Movement::create([
            'user' => auth()->id(),
            'project_id' => $validated['project_id'],
            'type' => 'expense',
            'reference_id' => $expense->id,
            'description' => $expense->description,
            'amount' => $expense->amount,
            'provider' => $expense->provider,
        ]);

        try {
            if (($validated['split_mode'] ?? 'none') === 'equal') {
                $splitExpense->equally($expense, $validated['split_user_ids'] ?? []);
            } elseif (($validated['split_mode'] ?? 'none') === 'fixed') {
                $splitExpense->fixed($expense, $validated['splits'] ?? []);
            }
        } catch (\InvalidArgumentException $exception) {
            throw ValidationException::withMessages([
                'splits' => $exception->getMessage(),
            ]);
        }

        return back();
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Expense $expense)
    {
        $this->authorize('update', $expense);

        $validated = $request->validate([
            'amount' => 'nullable|numeric',
            'description' => 'nullable|string|max:500',
            'currency' => 'nullable|string|in:$,bs,$bcv',
            'project_id' => 'nullable|integer|min:1'
        ]);

        if(isset($validated['amount'])){
            $rates = EarningsController::GetRates();
            $parallel = $rates['parallel'];
            $bcv = $rates['bcv'];
            $validated['amount'] = EarningsController::ConvertAmount($validated['currency'], $validated['amount'], $parallel, $bcv);
        }

        foreach($validated as $key => $value){
            if($value == null){
                unset($validated[$key]);
            }
        }

        $expense->update($validated);
        Movement::where('type', 'expense')->where('reference_id', $expense->id)->update([
            'project_id' => $expense->project_id,
            'description' => $expense->description,
            'amount' => $expense->amount,
            'provider' => $expense->provider,
        ]);

        return back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Expense $expense)
    {
        $this->authorize('delete', $expense);

        if($expense->term == null && $expense->project_id === null){
            if($expense->provider == 'box'){
                $provider = Box::where('user', auth()->id())->first();
            } else {
                $provider = Saving::where('user', auth()->id())->first();
            }
            $provider->amount += $expense->amount;
            $provider->save();
        }
        Movement::where('type', 'expense')->where('reference_id', $expense->id)->delete();
        $expense->delete();

        return back();
    }

    public function claim(Expense $expense){
        $this->authorize('update', $expense);

        if ($expense->project_id !== null) {
            return back();
        }

        if ($expense->provider == 'box') {
            $provider = Box::where('user', $expense->user)->first();
            $otherProvider = Saving::where('user', $expense->user)->first();
        } else {
            $provider = Saving::where('user', $expense->user)->first();
            $otherProvider = Box::where('user', $expense->user)->first();
        }
        self::SubtractProvider($provider, $otherProvider, $expense->amount);

        $lastUpdated = Carbon::parse($expense->UpdatedTerm);
        $now = Carbon::now();

        $daysElapsed = $lastUpdated->diffInDays($now);

        $expense->NextClaim = max(0, $expense->NextClaim - $daysElapsed) + $expense->term;

        $expense->UpdatedTerm = $now;
        $expense->save();

        return back();
    }
}
