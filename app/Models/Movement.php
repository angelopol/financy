<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Movement extends Model
{
    use HasFactory;

    protected $fillable = [
        'user',
        'type',
        'reference_id',
        'description',
        'amount',
        'provider',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user', 'id');
    }
}
