<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;
use App\Models\Box;
use App\Models\Earning;
use App\Models\Saving;
use Carbon\Carbon;
use Exception;

class EarningsController extends Controller
{
    public static function GetRates(){
        try {
            $response = Http::get('https://ve.dolarapi.com/v1/dolares');
        } catch (Exception $e) {
            return ['parallel' => 1, 'bcv' => 1];
        }

        return ['parallel' => $response->json()[1]['promedio'], 'bcv' => $response->json()[0]['promedio']];
    }

    public static function ConvertAmount($currency, $amount, $parallel, $bcv){
        if($currency == '$bcv'){
            $amount = ($amount * $bcv) / $parallel;
        } elseif ($currency == 'bs') {
            $amount = $amount / $parallel;
        }
        return $amount;
    }
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return Inertia::render('Earnings/Earnings', [
            'auth' => auth()->user(),
            'RecurringEarnings' => Earning::where('user', auth()->id())->where('term', '!=', null)->latest()->paginate(5),
            'OneTimeEarnings' => Earning::where('user', auth()->id())->where('term', null)->latest()->paginate(3),
            'rates' => self::GetRates()
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

        $rates = self::GetRates();
        $parallel = $rates['parallel'];
        $bcv = $rates['bcv'];

        $validated['user'] = auth()->id();
        
        $amount = self::ConvertAmount($validated['currency'], $validated['amount'], $parallel, $bcv);
        

        if($validated['provider'] == 'box'){
            $provider = Box::where('user', auth()->id())->first();
        } else {
            $provider = Saving::where('user', auth()->id())->first();
        }

        if(isset($validated['term'])){
            $validated['UpdatedTerm'] = now();
        } else {
            if($validated['currency'] != '$'){
                if($validated['currency'] == '$parallel'){
                    $amount = $amount / $parallel;
                }
                $validated['amount'] = $amount;
                $validated['currency'] = '$';
                $validated['OneTimeTase'] = $parallel;
            }
            $provider->amount += $amount;
            $provider->save();
        }

        if(isset($validated['nextterm'])){
            $validated['NextClaim'] = $validated['nextterm'];
        } else {
            $validated['NextClaim'] = $validated['term'];
        }

        $request->user()->earnings()->create($validated);

        return back();
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

        return back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Earning $earning)
    {
        $this->authorize('delete', $earning);

        if($earning->term == null){
            if($earning->provider == 'box'){
                $provider = Box::where('user', auth()->id())->first();
            } else {
                $provider = Saving::where('user', auth()->id())->first();
            }
            $provider->amount -= $earning->amount;
            $provider->save();
        }
        $earning->delete();

        return back();
    }

    public function claim(Earning $earning){
        $this->authorize('update', $earning);

        $rates = EarningsController::GetRates();
        $parallel = $rates['parallel'];
        $bcv = $rates['bcv'];

        if ($earning->provider == 'box') {
            $provider = Box::where('user', $earning->user)->first();
        } else {
            $provider = Saving::where('user', $earning->user)->first();
        }
        $amount = self::ConvertAmount($earning->currency, $earning->amount, $parallel, $bcv);
        $provider->amount += $amount;
        $provider->save();

        $lastUpdated = Carbon::parse($earning->UpdatedTerm);
        $now = Carbon::now();

        $daysElapsed = $lastUpdated->diffInDays($now);

        $earning->NextClaim = max(0, $earning->NextClaim - $daysElapsed) + $earning->term;

        $earning->UpdatedTerm = $now;
        $earning->save();

        return back();
    }
}
