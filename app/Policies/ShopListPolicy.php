<?php

namespace App\Policies;

use App\Models\ShopListItem;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ShopListPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        //
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, ShopListItem $shopListItem): bool
    {
        //
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        //
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, ShopListItem $shopListItem): bool
    {
        return $shopListItem->user()->is($user);
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, ShopListItem $shopListItem): bool
    {
        return $this->update($user, $shopListItem);
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function purchased(User $user, ShopListItem $shopListItem): bool
    {
        return $this->update($user, $shopListItem) && $shopListItem->status === 'pending';
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function pending(User $user, ShopListItem $shopListItem): bool
    {
        return $this->update($user, $shopListItem) && $shopListItem->status === 'purchased';
    }
}
