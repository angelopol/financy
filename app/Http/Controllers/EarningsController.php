<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;
use App\Models\Box;
use App\Models\Earning;
use App\Models\Saving;

class EarningsController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return Inertia::render('Earnings/Earnings', [
            'auth' => auth()->user(),
            'RecurringEarnings' => Earning::where('user', auth()->id())->where('term', '!=', null)->latest()->get(),
            'OneTimeEarnings' => Earning::where('user', auth()->id())->where('term', null)->latest()->get()
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
            'currency' => 'required|string|in:$,bs,$bcv,$parallel',
            'provider' => 'required|string|in:box,savings',
            'term' => 'nullable|numeric|min:1',
            'nextterm' => 'nullable|numeric'
        ]);

        $response = Http::get('https://ve.dolarapi.com/v1/dolares');
        $parallel = $response->json()[1]['promedio'];
        $bcv = $response->json()[0]['promedio'];

        $validated['user'] = auth()->id();
        
        if($validated['currency'] == '$bcv'){
            $amount = ($validated['amount'] * $bcv) / $parallel;
        } elseif ($validated['currency'] == 'bs') {
            $amount = $validated['amount'] / $parallel;
        } else {
            $amount = $validated['amount'];
        }

        if($validated['provider'] == 'box'){
            $provider = Box::where('user', auth()->id())->first();
        } elseif ($validated['provider'] == 'savings') {
            $provider = Saving::where('user', auth()->id())->first();
        }

        if(isset($validated['term'])){
            $validated['UpdatedTerm'] = now();
        } else {
            $validated['OneTimeTase'] = $parallel;
            $provider->amount += $amount;
            $provider->save();
        }

        if(isset($validated['nextterm'])){
            $validated['NextClaim'] = $validated['nextterm'];
        }

        $request->user()->earnings()->create($validated);

        return redirect(route('earnings.index'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Earning $earning)
    {
        $this->authorize('update', $earning);

        $validated = $request->validate([
            'description' => 'required|string|max:500'
        ]);

        $earning->update($validated);

        return redirect(route('earnings.index'));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Earning $earning)
    {
        $this->authorize('delete', $earning);

        $earning->delete();

        return redirect(route('earnings.index'));
    }
}
