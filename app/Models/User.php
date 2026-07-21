<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable;

    public function earnings(): HasMany
    {
        return $this->hasMany(Earning::class, 'user', 'id');
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class, 'user', 'id');
    }

    public function ShopListItems(): HasMany
    {
        return $this->hasMany(ShopListItem::class, 'user', 'id');
    }

    public function savings(): HasOne
    {
        return $this->hasOne(Saving::class, 'user', 'id');
    }

    public function box(): HasOne
    {
        return $this->hasOne(Box::class, 'user', 'id');
    }

    public function monthlyBudgets(): HasMany
    {
        return $this->hasMany(MonthlyBudget::class);
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'email',
        'password',
        'monthly_expense_limit',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'monthly_expense_limit' => 'decimal:2',
    ];
}
