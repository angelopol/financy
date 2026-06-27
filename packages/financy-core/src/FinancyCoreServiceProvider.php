<?php

namespace Idealo\FinancyCore;

use Illuminate\Support\ServiceProvider;

class FinancyCoreServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../database/migrations');
    }
}
