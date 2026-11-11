<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\FuelOps\FuelOpsClient;
use App\Services\FuelOps\FuelOpsSession;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    public const UNREACHABLE_MESSAGE = 'Could not reach the server. Please check your connection and try again.';

    public function __construct(private FuelOpsClient $client, private FuelOpsSession $session) {}

    public function create(): Response
    {
        return Inertia::render('auth/login', [
            'status' => $this->session->pullNotice(),
        ]);
    }

    /**
     * Signs in against the ERP. It either signs straight in, or (when OTP is switched on
     * there) answers with a challenge that the OTP step exchanges for the session.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ], [
            'username.required' => 'Please enter your username or email',
            'password.required' => 'Please enter your password',
        ]);

        $throttleKey = Str::transliterate(Str::lower($credentials['username']).'|'.$request->ip());

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            throw ValidationException::withMessages([
                'username' => __('auth.throttle', [
                    'seconds' => $seconds = RateLimiter::availableIn($throttleKey),
                    'minutes' => ceil($seconds / 60),
                ]),
            ]);
        }

        try {
            $response = $this->client->guest('POST', '/auth/login', $credentials);
        } catch (ConnectionException) {
            throw ValidationException::withMessages(['username' => self::UNREACHABLE_MESSAGE]);
        }

        if ($response->status() !== 200) {
            RateLimiter::hit($throttleKey);

            throw ValidationException::withMessages([
                'username' => FuelOpsClient::errorMessage($response, 'Login failed'),
            ]);
        }

        RateLimiter::clear($throttleKey);

        if (($signedIn = FuelOpsClient::credentialsFrom($response)) !== null) {
            $this->session->signIn($signedIn['token'], $signedIn['user']);

            return redirect()->intended(route('dashboard', absolute: false));
        }

        $challengeToken = $response->json('challenge_token');

        if (! is_string($challengeToken) || $challengeToken === '') {
            throw ValidationException::withMessages(['username' => 'Login failed']);
        }

        $this->session->startChallenge($challengeToken, $credentials['username']);

        return redirect()->route('otp.create');
    }
}
