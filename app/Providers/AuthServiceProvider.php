<?php
namespace App\Providers;

use App\Models\Earning;
use App\Models\ShopListItem;
use App\Policies\EarningsPolicy;
use App\Policies\ShopListPolicy;
use App\Models\Expense;
use App\Policies\ExpensesPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * The policy mappings for the application.
     *
     * @var array<class-string, class-string>
     */
    protected $policies = [
        Earning::class => EarningsPolicy::class,
        Expense::class => ExpensesPolicy::class,
        ShopListItem::class => ShopListPolicy::class,
    ];

    /**
     * Register any authentication / authorization services.
     */
    public function boot()
    {
        $this->registerPolicies();
    }
}