<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Box;
use App\Models\Saving;
use App\Models\Expense;

class ExpensesController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return Inertia::render('Expenses/Expenses', [
            'auth' => auth()->user(),
            'RecurringExpenses' => Expense::where('user', auth()->id())->where('term', '!=', null)->latest()->paginate(5),
            'OneTimeExpenses' => Expense::where('user', auth()->id())->where('term', null)->latest()->paginate(3),
            'rates' => EarningsController::GetRates()
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric',
            'description' => 'required|string|max:500',
            'currency' => 'required|string|in:$,bs,$bcv',
            'provider' => 'required|string|in:box,savings',
            'term' => 'nullable|numeric|min:1',
            'nextterm' => 'nullable|numeric'
        ]);

        $rates = EarningsController::GetRates();
        $parallel = $rates['parallel'];
        $bcv = $rates['bcv'];

        $validated['user'] = auth()->id();
        
        if($validated['currency'] == '$bcv'){
            $validated['amount'] = ($validated['amount'] * $bcv) / $parallel;
        } elseif ($validated['currency'] == 'bs') {
            $validated['amount'] = $validated['amount'] / $parallel;
        } else {
            $validated['amount'] = $validated['amount'];
        }

        if($validated['provider'] == 'box'){
            $provider = Box::where('user', auth()->id())->first();
        } else {
            $provider = Saving::where('user', auth()->id())->first();
        }

        if(isset($validated['term'])){
            $validated['UpdatedTerm'] = now();
        } else {
            $provider->amount -= $validated['amount'];
            $provider->save();
        }

        if(isset($validated['nextterm'])){
            $validated['NextClaim'] = $validated['nextterm'];
        }

        $request->user()->expenses()->create($validated);

        return redirect(route('expenses.index'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Expense $expense)
    {
        $this->authorize('update', $expense);

        $validated = $request->validate([
            'description' => 'required|string|max:500'
        ]);

        $expense->update($validated);

        return redirect(route('expenses.index'));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Expense $expense)
    {
        $this->authorize('delete', $expense);

        $expense->delete();

        return redirect(route('expenses.index'));
    }
}
