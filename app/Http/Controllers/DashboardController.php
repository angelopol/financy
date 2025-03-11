<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function ShowDashboard()
    {
        return Inertia::render('Dashboard');
    }

    public function ShowSavings()
    {
        //return Inertia::render('Savings');
    }

    public function ShowBox()
    {
        //return Inertia::render('Box');
    }

    public function transfer(){

    }
}
