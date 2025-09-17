<?php

namespace App\Models;

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

    protected $fillable = [
        'user',
        'shop_list_item_id',
        'recurring_id',
        'description',
        'amount',
        'provider',
        'term',
        'NextClaim',
        'UpdatedTerm'
    ];

    public function parentRecurring()
    {
        return $this->belongsTo(self::class, 'recurring_id', 'id');
    }

    public function generatedCycles()
    {
        return $this->hasMany(self::class, 'recurring_id', 'id');
    }
}
