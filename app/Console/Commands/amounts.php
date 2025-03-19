<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Earning;
use App\Models\Expense;
use App\Models\Box;
use App\Models\Saving;
use App\Http\Controllers\ExpensesController;

class amounts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'amounts:cron';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sum or subtract amounts of recurring earnings and expenses in savings or box.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $RecurringEarnings = Earning::where('term', '!=', null)
            ->whereRaw('DATE_ADD(UpdatedTerm, INTERVAL NextClaim DAY) <= CURDATE()')
            ->get();

        $RecurringExpenses = Expense::where('term', '!=', null)
            ->whereRaw('DATE_ADD(UpdatedTerm, INTERVAL NextClaim DAY) <= CURDATE()')
            ->get();

        foreach ($RecurringEarnings as $earning) {
            if ($earning->provider == 'box') {
                $provider = Box::where('user', auth()->id())->first();
            } else {
                $provider = Saving::where('user', auth()->id())->first();
            }
            $provider->amount += $earning->amount;
            $earning->NextClaim = $earning->term;
            $earning->UpdatedTerm = now();
            $earning->save();
        }
    
        foreach ($RecurringExpenses as $expense) {
            if ($expense->provider == 'box') {
                $provider = Box::where('user', auth()->id())->first();
                $otherProvider = Saving::where('user', auth()->id())->first();
            } else {
                $provider = Saving::where('user', auth()->id())->first();
                $otherProvider = Box::where('user', auth()->id())->first();
            }
            ExpensesController::SubtractProvider($provider, $otherProvider, $expense->amount);
            $expense->NextClaim = $expense->term;
            $expense->UpdatedTerm = now();
            $expense->save();
        }
    }
}
