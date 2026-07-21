<?php

namespace Tests\Feature\Auth;

use App\Models\Box;
use App\Models\Saving;
use App\Providers\RouteServiceProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_screen_can_be_rendered(): void
    {
        $response = $this->get('/register');

        $response->assertStatus(200);
    }

    public function test_new_users_can_register(): void
    {
        $response = $this->post('/register', [
            'founds' => 125.50,
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(RouteServiceProvider::HOME);

        $user = $this->app['auth']->user();

        $this->assertDatabaseHas(Saving::class, [
            'user' => $user->id,
            'amount' => 125.50,
        ]);
        $this->assertDatabaseHas(Box::class, [
            'user' => $user->id,
            'amount' => 0,
        ]);
    }
}
