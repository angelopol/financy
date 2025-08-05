<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

use App\Models\Earning;

class CalculatorController extends Controller
{
    public function show()
    {
        $rates = \App\Http\Controllers\EarningsController::GetRates();
        return inertia('Calculator/Calculator', [
            'auth' => auth()->user(),
            'rates' => $rates
        ]);
    }
}
