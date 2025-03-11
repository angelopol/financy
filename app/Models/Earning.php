<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Earning extends Model
{
    use HasFactory;

    protected $fillable = [
        'user',
        'description',
        'amount',
        'currency',
        'provider',
        'term',
        'UpdatedTerm',
        'OneTimeTase'
    ];
}
