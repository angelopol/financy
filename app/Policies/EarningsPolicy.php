<?php

namespace App\Policies;

use App\Models\Earning;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class EarningsPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return true; // Any authenticated user can view their list
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Earning $earning): bool
    {
        return (int)$earning->user === (int)$user->id;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return true; // Any authenticated user can create
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, Earning $earning): bool
    {
        return $earning->user()->is($user);
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, Earning $earning): bool
    {
        return $this->update($user, $earning);
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, Earning $earning): bool
    {
        return false;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, Earning $earning): bool
    {
        return false;
    }
}
