<?php

namespace App\Services\FuelOps;

use Closure;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;

/**
 * HTTP client for the FuelOps ERP API, authenticated as the signed-in user.
 */
class FuelOpsClient
{
    public const APP_ROLE_NOT_ALLOWED = 'app_role_not_allowed';

    public function __construct(private FuelOpsSession $session) {}

    /**
     * Sends a request without a bearer token (login and OTP steps).
     *
     * @param  array<string, mixed>  $json
     *
     * @throws ConnectionException
     */
    public function guest(string $method, string $path, array $json = []): Response
    {
        return $this->pending()->send($method, $this->url($path), ['json' => $json]);
    }

    /**
     * Sends a request as the signed-in user.
     *
     * A 401 triggers one token refresh and a retry, so a token that expired mid-session
     * doesn't force a new login. Pass the options as a closure when they hold streams
     * (file uploads), so the retry gets fresh ones.
     *
     * @param  array<string, mixed>|Closure(): array<string, mixed>  $options  Guzzle request options; `body` is sent as raw JSON
     * @param  array<string, string>  $headers
     *
     * @throws ConnectionException
     */
    public function send(string $method, string $path, array|Closure $options = [], array $headers = [], bool $refreshOnUnauthorized = true): Response
    {
        $attempt = function () use ($method, $path, $options, $headers): Response {
            $resolved = $options instanceof Closure ? $options() : $options;
            $request = $this->pending()->withHeaders($headers);

            if (($token = $this->session->token()) !== null) {
                $request->withToken($token);
            }

            if (array_key_exists('multipart', $resolved)) {
                $request->asMultipart();
            } elseif (array_key_exists('body', $resolved)) {
                $request->withBody($resolved['body'], 'application/json');
            }

            return $request->send($method, $this->url($path), $resolved);
        };

        $response = $attempt();

        if ($response->status() === 401 && $refreshOnUnauthorized && $this->refreshToken()) {
            $response = $attempt();
        }

        return $response;
    }

    /**
     * Exchanges the session's token for a new one.
     *
     * The ERP discards the old token on every refresh, so concurrent requests that all
     * hit a 401 must share one refresh: the first rotates the token, the rest pick the
     * rotated token up from the cache instead of refreshing with a token that is gone.
     */
    public function refreshToken(): bool
    {
        $staleToken = $this->session->token();

        if ($staleToken === null) {
            return false;
        }

        $fingerprint = hash('sha256', $staleToken);

        try {
            return Cache::lock("fuelops:refresh:{$fingerprint}", 20)->block(15, function () use ($staleToken, $fingerprint): bool {
                $rotated = Cache::get("fuelops:rotated:{$fingerprint}");

                if (is_string($rotated)) {
                    $this->session->setToken(Crypt::decryptString($rotated));

                    return true;
                }

                $response = $this->pending()->withToken($staleToken)->post($this->url('/auth/refresh'));
                $credentials = $response->ok() ? self::credentialsFrom($response) : null;

                if ($credentials === null) {
                    return false;
                }

                Cache::put("fuelops:rotated:{$fingerprint}", Crypt::encryptString($credentials['token']), now()->addDay());
                $this->session->setToken($credentials['token']);
                $this->session->setUser($credentials['user']);

                return true;
            });
        } catch (LockTimeoutException|ConnectionException) {
            return false;
        }
    }

    /**
     * Reads the token and user out of a sign-in response, which may be wrapped in `data`
     * and may name the token differently.
     *
     * @return array{token: string, user: array<string, mixed>}|null
     */
    public static function credentialsFrom(Response $response): ?array
    {
        $json = $response->json();

        if (! is_array($json)) {
            return null;
        }

        $payload = is_array($json['data'] ?? null) ? $json['data'] : $json;
        $token = $payload['token'] ?? $payload['access_token'] ?? $payload['accessToken'] ?? $payload['jwt'] ?? null;
        $user = $payload['user'] ?? null;

        if (! is_string($token) || $token === '' || ! is_array($user)) {
            return null;
        }

        return ['token' => $token, 'user' => $user];
    }

    /**
     * The message to show for a failed response: the first validation error when there
     * is one (Laravel's 422 summary is often just "The given data was invalid."), then
     * the response's own message.
     */
    public static function errorMessage(Response $response, string $fallback): string
    {
        $errors = $response->json('errors');

        if (is_array($errors) && $errors !== []) {
            $first = reset($errors);
            $first = is_array($first) ? reset($first) : $first;

            if (is_string($first) && $first !== '') {
                return $first;
            }
        }

        $message = $response->json('message');

        return is_string($message) && $message !== '' ? $message : $fallback;
    }

    /**
     * Whether the ERP ended this user's access because their role may no longer use the app.
     */
    public static function roleWasRevoked(Response $response): bool
    {
        return $response->status() === 403 && $response->json('code') === self::APP_ROLE_NOT_ALLOWED;
    }

    private function pending(): PendingRequest
    {
        return Http::acceptJson()
            ->timeout(config('fuelops.timeout'))
            ->connectTimeout(config('fuelops.connect_timeout'));
    }

    private function url(string $path): string
    {
        return config('fuelops.base_url').'/'.ltrim($path, '/');
    }
}
