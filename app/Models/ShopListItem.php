<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShopListItem extends Model
{
    use HasFactory;

    public function user()
    {
        return $this->belongsTo(User::class, 'user', 'id');
    }

    public function expense()
    {
        return $this->hasOne(Expense::class, 'shop_list_item_id', 'id');
    }

    protected $fillable = [
        'user',
        'description',
        'amount',
        'provider',
        'status'
    ];

    protected $table = 'shop_list_items';
}
