<?php

use App\Services\FuelOps\FuelOpsSession;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config(['fuelops.base_url' => 'https://erp.test/api/v1']);
});

function signInToErp(): void
{
    app(FuelOpsSession::class)->signIn('erp-token', ['userId' => '7', 'fullName' => 'Ama Mensah']);
}

test('guests get a JSON 401 from the gateway', function () {
    Http::fake();

    $this->getJson('/api/fuelops/tickets/assigned')
        ->assertUnauthorized()
        ->assertJson(['code' => 'session_expired']);

    Http::assertNothingSent();
});

test('GET requests are forwarded with the bearer token and query string', function () {
    Http::fake(['erp.test/api/v1/products*' => Http::response(['data' => [['productId' => 1]]])]);
    signInToErp();

    $this->getJson('/api/fuelops/products?search=cable&warehouse=IT')
        ->assertOk()
        ->assertJson(['data' => [['productId' => 1]]]);

    Http::assertSent(fn (Request $request) => $request->method() === 'GET'
        && str_starts_with($request->url(), 'https://erp.test/api/v1/products?')
        && $request->data() === ['search' => 'cable', 'warehouse' => 'IT']
        && $request->hasHeader('Authorization', 'Bearer erp-token'));
});

test('JSON bodies and idempotency keys are forwarded unchanged', function () {
    Http::fake(['erp.test/api/v1/tickets/TKT-1/accept' => Http::response(['ticketId' => 'TKT-1'])]);
    signInToErp();

    $this->postJson('/api/fuelops/tickets/TKT-1/accept', ['geo_location' => null], ['Idempotency-Key' => 'accept:TKT-1'])
        ->assertOk();

    Http::assertSent(fn (Request $request) => $request->method() === 'POST'
        && $request->body() === '{"geo_location":null}'
        && $request->hasHeader('Idempotency-Key', 'accept:TKT-1'));
});

test('ERP error statuses and bodies are passed back', function () {
    Http::fake(['erp.test/*' => Http::response(['message' => 'Another leader assigned it first.'], 409)]);
    signInToErp();

    $this->postJson('/api/fuelops/tickets/TKT-1/assign', ['technician_id' => 3])
        ->assertStatus(409)
        ->assertJson(['message' => 'Another leader assigned it first.']);
});

test('file uploads are forwarded as multipart', function () {
    Http::fake(['erp.test/api/v1/job-cards/photos' => Http::response(['urls' => ['https://erp.test/p.jpg']])]);
    signInToErp();

    $this->post('/api/fuelops/job-cards/photos', [
        'ticket_id' => 'TKT-1',
        'photos' => [UploadedFile::fake()->image('site.jpg')],
    ], ['Accept' => 'application/json'])->assertOk()->assertJson(['urls' => ['https://erp.test/p.jpg']]);

    Http::assertSent(fn (Request $request) => $request->isMultipart()
        && collect($request->data())->contains(fn ($part) => $part['name'] === 'ticket_id' && $part['contents'] === 'TKT-1')
        && collect($request->data())->contains(fn ($part) => $part['name'] === 'photos[0]' && $part['filename'] === 'site.jpg'));
});

test('session endpoints cannot be reached through the gateway', function () {
    Http::fake();
    signInToErp();

    $this->postJson('/api/fuelops/auth/logout')->assertNotFound();
    $this->postJson('/api/fuelops/devices/register')->assertNotFound();

    Http::assertNothingSent();
});

test('a 401 the refresh cannot fix ends the session', function () {
    Http::fake([
        'erp.test/api/v1/auth/refresh' => Http::response(['message' => 'Unauthenticated.'], 401),
        'erp.test/*' => Http::response(['message' => 'Unauthenticated.'], 401),
    ]);
    signInToErp();

    $this->getJson('/api/fuelops/tickets/assigned')->assertUnauthorized();

    expect(app(FuelOpsSession::class)->isAuthenticated())->toBeFalse();
});

test('profile updates refresh the signed-in user', function () {
    Http::fake(['erp.test/api/v1/users/profile' => Http::response(['user' => ['userId' => '7', 'fullName' => 'Ama K. Mensah']])]);
    signInToErp();

    $this->patchJson('/api/fuelops/users/profile', ['full_name' => 'Ama K. Mensah'])->assertOk();

    expect(app(FuelOpsSession::class)->user()['fullName'])->toBe('Ama K. Mensah');
});
