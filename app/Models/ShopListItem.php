<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShopListItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'user',
        'description',
        'amount',
        'provider',
        'status'
    ];
}
