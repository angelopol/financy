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
        'recurring_id',
        'description',
        'amount',
        'currency',
        'provider',
        'term',
        'NextClaim',
        'UpdatedTerm',
        'OneTimeTase'
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
