<?php

use App\Services\FuelOps\FuelOpsSession;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['fuelops.base_url' => 'https://erp.test/api/v1']);
    $this->withoutVite();
});

test('signed-in users can visit the dashboard and receive their profile', function () {
    app(FuelOpsSession::class)->signIn('erp-token', ['user_id' => 7, 'full_name' => 'Ama Mensah', 'is_cluster_leader' => true]);

    $this->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('auth.user.userId', '7')
            ->where('auth.user.fullName', 'Ama Mensah')
            ->where('auth.user.isClusterLeader', true));
});

test('a stale profile is refreshed from the ERP so role changes arrive', function () {
    Http::fake(['erp.test/api/v1/auth/me' => Http::response(['user' => ['userId' => '7', 'fullName' => 'Ama Mensah', 'isClusterLeader' => true]])]);
    app(FuelOpsSession::class)->signIn('erp-token', ['userId' => '7', 'fullName' => 'Ama Mensah', 'isClusterLeader' => false]);
    $this->travel(config('fuelops.profile_refresh_seconds') + 1)->seconds();

    $this->get('/dashboard')->assertInertia(fn (Assert $page) => $page->where('auth.user.isClusterLeader', true));
});

test('a role the app no longer allows ends the session with the ERP reason', function () {
    Http::fake(['erp.test/api/v1/auth/me' => Http::response(['code' => 'app_role_not_allowed', 'message' => 'Cluster Engineers cannot use the app.'], 403)]);
    app(FuelOpsSession::class)->signIn('erp-token', ['userId' => '7']);
    $this->travel(config('fuelops.profile_refresh_seconds') + 1)->seconds();

    $this->get('/dashboard')->assertRedirect('/login');
    $this->get('/login')->assertInertia(fn (Assert $page) => $page->where('status', 'Cluster Engineers cannot use the app.'));
});

test('an expired token is refreshed once and the request retried', function () {
    Http::fake([
        'erp.test/api/v1/auth/me' => Http::sequence()
            ->push(['message' => 'Unauthenticated.'], 401)
            ->push(['user' => ['userId' => '7', 'fullName' => 'Ama Mensah']]),
        'erp.test/api/v1/auth/refresh' => Http::response(['token' => 'new-token', 'user' => ['userId' => '7', 'fullName' => 'Ama Mensah']]),
    ]);
    app(FuelOpsSession::class)->signIn('old-token', ['userId' => '7']);
    $this->travel(config('fuelops.profile_refresh_seconds') + 1)->seconds();

    $this->get('/dashboard')->assertOk();

    expect(app(FuelOpsSession::class)->token())->toBe('new-token');
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/auth/me') && $request->hasHeader('Authorization', 'Bearer new-token'));
});

test('the home url redirects to the dashboard', function () {
    $this->get('/')->assertRedirect('/dashboard');
});
