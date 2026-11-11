<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\OtpController;
use App\Http\Controllers\FuelOpsGatewayController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::redirect('/', '/dashboard')->name('home');

Route::middleware('fuelops.guest')->group(function () {
    Route::get('login', [LoginController::class, 'create'])->name('login');
    Route::post('login', [LoginController::class, 'store'])->name('login.store');

    Route::get('otp-verification', [OtpController::class, 'create'])->name('otp.create');
    Route::post('otp-verification', [OtpController::class, 'store'])->middleware('throttle:10,1')->name('otp.store');
    Route::post('otp-verification/resend', [OtpController::class, 'resend'])->middleware('throttle:3,1')->name('otp.resend');
    Route::delete('otp-verification', [OtpController::class, 'destroy'])->name('otp.destroy');
});

Route::post('logout', LogoutController::class)->name('logout');

/*
| Every page below is a screen of the Star Technician app. Pages load and save
| their own data through the gateway at the bottom of this file, so the routes
| only decide which page to render.
*/
Route::middleware('fuelops.auth')->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
    Route::inertia('notifications', 'notifications/index')->name('notifications.index');

    // Tickets and job cards
    Route::inertia('tickets', 'tickets/index')->name('tickets.index');
    Route::inertia('tickets/create', 'tickets/create')->name('tickets.create');
    Route::get('tickets/{ticketId}', fn (string $ticketId) => Inertia::render('tickets/show', ['ticketId' => $ticketId]))
        ->name('tickets.show');

    // Projects and special assignments
    Route::inertia('projects', 'projects/index')->name('projects.index');
    Route::inertia('special-assignments', 'special-assignments/index')->name('special-assignments.index');
    Route::inertia('special-assignments/create', 'special-assignments/create')->name('special-assignments.create');
    Route::inertia('compliance', 'compliance/index')->name('compliance.index');

    // Stock
    Route::inertia('requisitions', 'requisitions/index')->name('requisitions.index');
    Route::inertia('requisitions/create', 'requisitions/create')->name('requisitions.create');
    Route::get('requisitions/{requisitionId}', fn (string $requisitionId) => Inertia::render('requisitions/show', ['requisitionId' => $requisitionId]))
        ->name('requisitions.show');
    Route::inertia('inventory/requests', 'inventory/requests')->name('inventory.requests');
    Route::inertia('inventory', 'inventory/stock')->name('inventory.stock');

    // Dispatch (Cluster Leaders, and technicians covering for one)
    Route::inertia('dispatch/queue', 'dispatch/queue')->name('dispatch.queue');
    Route::inertia('dispatch/covers', 'dispatch/covers')->name('dispatch.covers');
    Route::inertia('dispatch/report', 'dispatch/report')->name('dispatch.report');

    // Cluster and operations oversight
    Route::inertia('cluster/overview', 'cluster/overview')->name('cluster.overview');
    Route::inertia('cluster/team-requests', 'cluster/inventory-approvals')->name('cluster.inventory-approvals');
    Route::inertia('cluster/mini-store', 'cluster/mini-store')->name('cluster.mini-store');
    Route::inertia('cluster/job-cards', 'cluster/job-cards')->name('cluster.job-cards');
    Route::inertia('operations/overview', 'operations/overview')->name('operations.overview');
    Route::inertia('technicians', 'technicians/index')->name('technicians.index');

    // Personal
    Route::inertia('reports', 'reports/index')->name('reports.index');
    Route::inertia('location', 'location/index')->name('location.index');
    Route::inertia('profile', 'profile/index')->name('profile.index');
    Route::inertia('settings/appearance', 'settings/appearance')->name('appearance');
});

Route::any('api/fuelops/{path}', FuelOpsGatewayController::class)
    ->where('path', '.*')
    ->middleware('fuelops.auth:api')
    ->name('fuelops.gateway');
