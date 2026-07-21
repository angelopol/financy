<?php

namespace App\Models;

use App\Services\RecurringSchedule;
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
        'project_id',
        'recurring_id',
        'description',
        'slug',
        'amount',
        'currency',
        'provider',
        'term',
        'NextClaim',
        'UpdatedTerm',
        'OneTimeTase',
        'recurrence_type',
        'claim_day',
        'auto_claim',
        'last_notified_claim_at',
    ];

    protected $casts = [
        'auto_claim' => 'boolean',
        'claim_day' => 'integer',
        'UpdatedTerm' => 'datetime',
        'last_notified_claim_at' => 'datetime',
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
