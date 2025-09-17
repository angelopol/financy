<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\ShopListItem;
use App\Models\Box;
use App\Models\Saving;
use App\Models\Expense;

class ShopListController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return Inertia::render('ShopList/ShopList', [
            'auth' => auth()->user(),
            'ShopListItems' => ShopListItem::where('user', auth()->id())
                ->orderByRaw("CASE WHEN status = 'pending' THEN 0 ELSE 1 END")
                ->latest()->paginate(10),
            'TotalAmount' => ShopListItem::where('user', auth()->id())
                ->where('status', 'pending')
                ->sum('amount'),
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
            'currency' => 'required|string|in:$,bs,$bcv'
        ]);

        $rates = EarningsController::GetRates();
        $parallel = $rates['parallel'];
        $bcv = $rates['bcv'];

        $validated['user'] = auth()->id();
        $validated['status'] = 'pending';
        $validated['amount'] = EarningsController::ConvertAmount($validated['currency'], $validated['amount'], $parallel, $bcv);

        $request->user()->ShopListItems()->create($validated);

        return back();
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, ShopListItem $ShopListItem)
    {
        $this->authorize('update', $ShopListItem);

        $validated = $request->validate([
            'amount' => 'nullable|numeric',
            'description' => 'nullable|string|max:500',
            'currency' => 'nullable|string|in:$,bs,$bcv'
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

        $ShopListItem->update($validated);

        return back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ShopListItem $ShopListItem)
    {
        $this->authorize('delete', $ShopListItem);

        $ShopListItem->delete();

        return back();
    }

    public function purchase(Request $request, ShopListItem $ShopListItem)
    {
        $this->authorize('purchased', $ShopListItem);

        $validated = $request->validate([
            'provider' => 'required|string|in:box,savings',
            'amount' => 'required|numeric|min:0'
        ]);

        if($validated['provider'] == 'box'){
            $provider = Box::where('user', auth()->id())->first();
            $otherProvider = Saving::where('user', auth()->id())->first();
        } else {
            $provider = Saving::where('user', auth()->id())->first();
            $otherProvider = Box::where('user', auth()->id())->first();
        }
        ExpensesController::SubtractProvider($provider, $otherProvider, floatval($validated['amount']));

        $ShopListItem->provider = $validated['provider'];
        $ShopListItem->amount = floatval($validated['amount']);
        $ShopListItem->status = 'purchased';
        $ShopListItem->save();

        // Create a one-time expense entry for history using the chosen amount
        $expenseData = [
            'description' => $ShopListItem->description,
            'amount' => floatval($validated['amount']),
            'provider' => $validated['provider'],
            'term' => null,
            'NextClaim' => null,
            'UpdatedTerm' => null,
        ];
        // Link the created expense to this shop list item to avoid double-refunds later
        $expenseData['shop_list_item_id'] = $ShopListItem->id;
        $request->user()->expenses()->create($expenseData);

        return back();
    }

    public function gift(ShopListItem $ShopListItem)
    {
        $this->authorize('gift', $ShopListItem);

        // If an expense was created when it was purchased, delete it to prevent refunds elsewhere
        if ($ShopListItem->expense) {
            // Deleting the expense will not refund (destroy() only refunds when term is null and we call it). Here we directly delete.
            $ShopListItem->expense()->delete();
        }

        $ShopListItem->provider = null;
        $ShopListItem->status = 'purchased';
        $ShopListItem->save();

        return back();
    }

    public function pending(ShopListItem $ShopListItem)
    {
        $this->authorize('pending', $ShopListItem);

        // If there is a linked expense for this purchase, delete it and DO NOT refund here to avoid double adjustments.
        if ($ShopListItem->expense) {
            $ShopListItem->expense()->delete();
        } else {
            // Backward compatibility: For old purchases without linked expense, perform the manual refund once.
            if($ShopListItem->provider != null){
                if($ShopListItem->provider == 'box'){
                    $provider = Box::where('user', auth()->id())->first();
                } else {
                    $provider = Saving::where('user', auth()->id())->first();
                }
                $provider->amount += $ShopListItem->amount;
                $provider->save();
            }
        }

        $ShopListItem->provider = null;
        $ShopListItem->status = 'pending';
        $ShopListItem->save();

        return back();
    }
}
