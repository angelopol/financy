<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Earning;
use App\Models\Expense;
use App\Models\ShopListItem;
use App\Models\Saving;
use App\Models\Box;

class DashboardController extends Controller
{
    private function GetItems($provider, $GetOneTime = true){
        $RecurringEarnings = Earning::where('user', auth()->id())->where('term', '!=', null)->where('provider', $provider)->latest()->paginate(5);
        $RecurringExpenses = Expense::where('user', auth()->id())->where('term', '!=', null)->where('provider', $provider)->latest()->paginate(5);
        
        if($GetOneTime){
            $OneTimeEarnings = Earning::where('user', auth()->id())->where('term', null)->where('provider', $provider)->latest()->paginate(3);
            $OneTimeExpenses = Expense::where('user', auth()->id())->where('term', null)->where('provider', $provider)->latest()->paginate(3);
            $ShopListItems = ShopListItem::where('user', auth()->id())->orderByRaw("CASE WHEN status = 'pending' THEN 0 ELSE 1 END")
                ->where('provider', $provider)->latest()->paginate(10);
        } else {
            $OneTimeEarnings = null;
            $OneTimeExpenses = null;
            $ShopListItems = null;
        }

        $TotalRecurringEarnings = 0;
        $rates = EarningsController::GetRates();
        $parallel = $rates['parallel'];
        $bcv = $rates['bcv'];
        foreach ($RecurringEarnings as $RecurringEarning) {
            $TotalRecurringEarnings += EarningsController::ConvertAmount($RecurringEarning->currency, $RecurringEarning->amount, $parallel, $bcv);
        }
        $ExpectedSavings = round($TotalRecurringEarnings - $RecurringExpenses->sum('amount'), 2);

        return [
            'auth' => auth()->user(),
            'rates' => $rates,
            'RecurringEarnings' => $RecurringEarnings,
            'OneTimeEarnings' => $OneTimeEarnings,
            'RecurringExpenses' => $RecurringExpenses,
            'OneTimeExpenses' => $OneTimeExpenses,
            'ShopListItems' => $ShopListItems,
            'ExpectedSavings' => $ExpectedSavings
        ];
    }

    public function ShowDashboard()
    {
        [$auth, $rates, $RecurringEarnings, $OneTimeEarnings, $RecurringExpenses, $OneTimeExpenses, $ShopListItems, $ExpectedBox] = array_values($this->GetItems('box', false));
        [$auth, $rates, $RecurringEarnings, $OneTimeEarnings, $RecurringExpenses, $OneTimeExpenses, $ShopListItems, $ExpectedSavings] = array_values($this->GetItems('savings', false));
        return Inertia::render('Dashboard', [
            'savings' => Saving::where('user', auth()->id())->value('amount'),
            'box' => Box::where('user', auth()->id())->value('amount'),
            'ExpectedBox' => $ExpectedBox,
            'ExpectedSavings' => $ExpectedSavings,
            'auth' => $auth,
            'rates' => $rates
        ]);
    }

    public function ShowSavings()
    {
        return Inertia::render('Savings/Savings', [
            ...$this->GetItems('savings'),
            'savings' => Saving::where('user', auth()->id())->value('amount')
        ]);
    }

    public function ShowBox()
    {
        return Inertia::render('Box/Box', [
            ...$this->GetItems('box'),
            'box' => Box::where('user', auth()->id())->value('amount')
        ]);
    }

    public function transfer(Request $request){
        $box = Box::where('user', auth()->id())->first();
        $validated = $request->validate([
            'amount' => 'required|numeric|min:1|max:'.$box->amount
        ]);
        $savings = Saving::where('user', auth()->id())->first();
        $box = Box::where('user', auth()->id())->first();
        $savings->amount += $validated['amount'];
        $box->amount -= $validated['amount'];
        $savings->save();
        $box->save();
        return redirect()->route('box.show');
    }

    public function transferToSavings(Request $request){
        $savings = Saving::where('user', auth()->id())->first();
        $validated = $request->validate([
            'amount' => 'required|numeric|min:1|max:'.$savings->amount
        ]);
        $box = Box::where('user', auth()->id())->first();
        $box->amount += $validated['amount'];
        $savings->amount -= $validated['amount'];
        $savings->save();
        $box->save();
        return redirect()->route('savings.show');
    }
}