<?php

namespace Idealo\FinancyRates;

use Illuminate\Support\ServiceProvider;

class FinancyRatesServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/financy-rates.php', 'financy-rates');
    }

    public function boot(): void
    {
        $this->publishes([
            __DIR__.'/../config/financy-rates.php' => config_path('financy-rates.php'),
        ], 'financy-rates-config');
    }
}
