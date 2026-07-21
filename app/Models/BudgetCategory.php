<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetCategory extends Model
{
    protected $fillable = ['monthly_budget_id', 'name', 'amount', 'slug'];

    protected $casts = ['amount' => 'decimal:2'];

    public function budget(): BelongsTo
    {
        return $this->belongsTo(MonthlyBudget::class, 'monthly_budget_id');
    }
}
