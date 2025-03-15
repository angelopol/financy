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
    private function GetItems($provider){
        $RecurringEarnings = Earning::where('user', auth()->id())->where('term', '!=', null)->where('provider', $provider)->latest()->paginate(5);
        $OneTimeEarnings = Earning::where('user', auth()->id())->where('term', null)->where('provider', $provider)->latest()->paginate(3);
        $RecurringExpenses = Expense::where('user', auth()->id())->where('term', '!=', null)->where('provider', $provider)->latest()->paginate(5);
        $OneTimeExpenses = Expense::where('user', auth()->id())->where('term', null)->where('provider', $provider)->latest()->paginate(3);
        $ShopListItems = ShopListItem::where('user', auth()->id())->orderByRaw("CASE WHEN status = 'pending' THEN 0 ELSE 1 END")
            ->where('provider', $provider)->latest()->paginate(10);

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
        return Inertia::render('Dashboard');
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

    public function transfer(){
        $savings = Saving::where('user', auth()->id())->first();
        $box = Box::where('user', auth()->id())->first();
        $savings->amount += $box->amount;
        $box->amount = 0;
        $savings->save();
        $box->save();
        return redirect()->route('box.show');
    }
}