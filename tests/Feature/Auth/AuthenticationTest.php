<?php

use App\Services\FuelOps\FuelOpsSession;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['fuelops.base_url' => 'https://erp.test/api/v1']);
    $this->withoutVite();
});

function erpUser(array $overrides = []): array
{
    return [
        'userId' => '7',
        'fullName' => 'Ama Mensah',
        'username' => 'ama',
        'role' => 'Technician',
        'isClusterLeader' => false,
        'canDispatch' => false,
        ...$overrides,
    ];
}

test('login screen can be rendered', function () {
    $this->get('/login')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('auth/login'));
});

test('guests are redirected to the login page', function () {
    $this->get('/dashboard')->assertRedirect('/login');
});

test('users are signed in when the ERP answers with a token', function () {
    Http::fake(['erp.test/api/v1/auth/login' => Http::response(['token' => 'erp-token', 'user' => erpUser()])]);

    $this->post('/login', ['username' => 'ama', 'password' => 'secret'])
        ->assertRedirect('/dashboard');

    expect(app(FuelOpsSession::class)->token())->toBe('erp-token')
        ->and(app(FuelOpsSession::class)->user()['fullName'])->toBe('Ama Mensah');
    Http::assertSent(fn (Request $request) => $request['username'] === 'ama' && $request['password'] === 'secret');
});

test('the ERP token is never stored in the session in plain text', function () {
    Http::fake(['erp.test/api/v1/auth/login' => Http::response(['token' => 'erp-token', 'user' => erpUser()])]);

    $this->post('/login', ['username' => 'ama', 'password' => 'secret']);

    expect(json_encode(session()->all()))->not->toContain('erp-token');
});

test('the ERP rejection message is shown for invalid credentials', function () {
    Http::fake(['erp.test/api/v1/auth/login' => Http::response(['message' => 'Invalid credentials'], 401)]);

    $this->post('/login', ['username' => 'ama', 'password' => 'wrong'])
        ->assertSessionHasErrors(['username' => 'Invalid credentials']);

    expect(app(FuelOpsSession::class)->isAuthenticated())->toBeFalse();
});

test('an unreachable ERP gives a connection message', function () {
    Http::fake(fn () => throw new ConnectionException('timed out'));

    $this->post('/login', ['username' => 'ama', 'password' => 'secret'])
        ->assertSessionHasErrors(['username' => 'Could not reach the server. Please check your connection and try again.']);
});

test('an OTP challenge leads to the verification step and the code completes sign in', function () {
    Http::fake([
        'erp.test/api/v1/auth/login' => Http::response(['challenge_token' => 'challenge-1']),
        'erp.test/api/v1/auth/verify-otp' => Http::response(['token' => 'erp-token', 'user' => erpUser()]),
    ]);

    $this->post('/login', ['username' => 'ama', 'password' => 'secret'])->assertRedirect('/otp-verification');
    $this->get('/otp-verification')->assertInertia(fn (Assert $page) => $page->component('auth/otp')->where('username', 'ama'));
    expect(app(FuelOpsSession::class)->isAuthenticated())->toBeFalse();

    $this->post('/otp-verification', ['otp_code' => '123456'])->assertRedirect('/dashboard');

    expect(app(FuelOpsSession::class)->token())->toBe('erp-token');
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/auth/verify-otp')
        && $request['challenge_token'] === 'challenge-1'
        && $request['otp_code'] === '123456');
});

test('the OTP step needs a pending challenge', function () {
    $this->get('/otp-verification')->assertRedirect('/login');
});

test('a wrong OTP code shows the ERP message', function () {
    Http::fake([
        'erp.test/api/v1/auth/login' => Http::response(['challenge_token' => 'challenge-1']),
        'erp.test/api/v1/auth/verify-otp' => Http::response(['message' => 'Invalid OTP code'], 422),
    ]);
    $this->post('/login', ['username' => 'ama', 'password' => 'secret']);

    $this->post('/otp-verification', ['otp_code' => '000000'])
        ->assertSessionHasErrors(['otp_code' => 'Invalid OTP code']);
});

test('users can log out', function () {
    Http::fake(['erp.test/api/v1/auth/logout' => Http::response([], 200)]);
    app(FuelOpsSession::class)->signIn('erp-token', erpUser());

    $this->post('/logout')->assertRedirect('/login');

    expect(app(FuelOpsSession::class)->isAuthenticated())->toBeFalse();
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/auth/logout')
        && $request->hasHeader('Authorization', 'Bearer erp-token'));
});

test('logging out still works when the ERP is unreachable', function () {
    Http::fake(fn () => throw new ConnectionException('timed out'));
    app(FuelOpsSession::class)->signIn('erp-token', erpUser());

    $this->post('/logout')->assertRedirect('/login');

    expect(app(FuelOpsSession::class)->isAuthenticated())->toBeFalse();
});

test('signed-in users visiting login go to the dashboard', function () {
    app(FuelOpsSession::class)->signIn('erp-token', erpUser());

    $this->get('/login')->assertRedirect('/dashboard');
});
