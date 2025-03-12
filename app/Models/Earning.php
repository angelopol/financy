<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Earning extends Model
{
    use HasFactory;

    public function user()
    {
        return $this->belongsTo(User::class, 'user', 'id');
    }

    protected $fillable = [
        'user',
        'description',
        'amount',
        'currency',
        'provider',
        'term',
        'NextTerm',
        'UpdatedTerm',
        'OneTimeTase'
    ];
}
