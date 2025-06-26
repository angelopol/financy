<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ExpensesController;
use App\Http\Controllers\EarningsController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ShopListController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::resource('/earnings', EarningsController::class)->only(['index', 'store', 'update', 'destroy'])->middleware('auth');
    Route::post('/earnings/{earning}/claim', [EarningsController::class, 'claim'])->name('earnings.claim');
    Route::resource('/expenses', ExpensesController::class)->only(['index', 'store', 'update', 'destroy'])->middleware('auth');
    Route::post('/expenses/{expense}/claim', [ExpensesController::class, 'claim'])->name('expenses.claim');

    Route::post('/shop-list', [ShopListController::class, 'store'])->name('shoplist.store');
    Route::get('/shop-list', [ShopListController::class, 'index'])->name('shoplist.index');
    Route::patch('/shop-list/{ShopListItem}', [ShopListController::class, 'update'])->name('shoplist.update');
    Route::delete('/shop-list/{ShopListItem}', [ShopListController::class, 'destroy'])->name('shoplist.destroy');
    Route::post('/shop-list/{ShopListItem}/purchase', [ShopListController::class, 'purchase'])->name('shoplist.purchased');
    Route::post('/shop-list/{ShopListItem}/pending', [ShopListController::class, 'pending'])->name('shoplist.pending');
    Route::post('/shop-list/{ShopListItem}/gift', [ShopListController::class, 'gift'])->name('shoplist.gift');

    Route::get('/dashboard', [DashboardController::class, 'ShowDashboard'])->name('dashboard');
    Route::get('/savings', [DashboardController::class, 'ShowSavings'])->name('savings.show');
    Route::post('/savings/transfer', [DashboardController::class, 'transferToSavings'])->name('savings.transfer');
    Route::get('/box', [DashboardController::class, 'ShowBox'])->name('box.show');
    Route::post('/box/transfer', [DashboardController::class, 'transfer'])->name('box.transfer');
});

require __DIR__.'/auth.php';
