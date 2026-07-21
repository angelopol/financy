<?php

namespace App\Models;

use App\Services\RecurringSchedule;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    use HasFactory;

    public function user()
    {
        return $this->belongsTo(User::class, 'user', 'id');
    }

    public function shopListItem()
    {
        return $this->belongsTo(ShopListItem::class, 'shop_list_item_id', 'id');
    }

    public function splits()
    {
        return $this->hasMany(ExpenseSplit::class);
    }

    protected $fillable = [
        'user',
        'project_id',
        'shop_list_item_id',
        'recurring_id',
        'description',
        'slug',
        'amount',
        'provider',
        'term',
        'NextClaim',
        'UpdatedTerm',
        'recurrence_type',
        'claim_day',
        'auto_claim',
    ];

    protected $casts = [
        'auto_claim' => 'boolean',
        'claim_day' => 'integer',
        'UpdatedTerm' => 'datetime',
    ];

    protected $appends = ['next_claim_at'];

    public function getNextClaimAtAttribute(): ?string
    {
        return app(RecurringSchedule::class)->dueAt($this)?->toIso8601String();
    }

    public function parentRecurring()
    {
        return $this->belongsTo(self::class, 'recurring_id', 'id');
    }

    public function generatedCycles()
    {
        return $this->hasMany(self::class, 'recurring_id', 'id');
    }
}
