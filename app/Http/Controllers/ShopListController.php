<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\ShopListItem;
use App\Models\Box;
use App\Models\Saving;

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
            'provider' => 'required|string|in:box,savings'
        ]);

        if($ShopListItem->provider == 'box'){
            $provider = Box::where('user', auth()->id())->first();
            $otherProvider = Saving::where('user', auth()->id())->first();
        } else {
            $provider = Saving::where('user', auth()->id())->first();
            $otherProvider = Box::where('user', auth()->id())->first();
        }
        ExpensesController::SubtractProvider($provider, $otherProvider, $ShopListItem->amount);

        $ShopListItem->provider = $validated['provider'];
        $ShopListItem->status = 'purchased';
        $ShopListItem->save();

        return back();
    }

    public function gift(ShopListItem $ShopListItem)
    {
        $this->authorize('gift', $ShopListItem);

        $ShopListItem->provider = null;
        $ShopListItem->status = 'purchased';
        $ShopListItem->save();

        return back();
    }

    public function pending(ShopListItem $ShopListItem)
    {
        $this->authorize('pending', $ShopListItem);

        if($ShopListItem->provider != null){
            if($ShopListItem->provider == 'box'){
                $provider = Box::where('user', auth()->id())->first();
            } else {
                $provider = Saving::where('user', auth()->id())->first();
            }
            $provider->amount += $ShopListItem->amount;
            $provider->save();
        }

        $ShopListItem->provider = null;
        $ShopListItem->status = 'pending';
        $ShopListItem->save();

        return back();
    }
}
