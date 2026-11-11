<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\FuelOps\FuelOpsClient;
use App\Services\FuelOps\FuelOpsSession;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OtpController extends Controller
{
    private const EXPIRED_MESSAGE = 'Your login session has expired. Please log in again.';

    public function __construct(private FuelOpsClient $client, private FuelOpsSession $session) {}

    public function create(): Response|RedirectResponse
    {
        $challenge = $this->session->challenge();

        if ($challenge === null) {
            return redirect()->route('login');
        }

        return Inertia::render('auth/otp', [
            'username' => $challenge['username'],
            'status' => session('status'),
        ]);
    }

    /**
     * Exchanges the OTP code and the login challenge for the signed-in session.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'otp_code' => ['required', 'digits:6'],
        ], [
            'otp_code.*' => 'Please enter the complete 6-digit code',
        ]);

        $challenge = $this->session->challenge();

        if ($challenge === null) {
            return redirect()->route('login')->with('status', self::EXPIRED_MESSAGE);
        }

        try {
            $response = $this->client->guest('POST', '/auth/verify-otp', [
                'challenge_token' => $challenge['token'],
                'otp_code' => $validated['otp_code'],
            ]);
        } catch (ConnectionException) {
            throw ValidationException::withMessages(['otp_code' => LoginController::UNREACHABLE_MESSAGE]);
        }

        $signedIn = $response->status() === 200 ? FuelOpsClient::credentialsFrom($response) : null;

        if ($signedIn === null) {
            throw ValidationException::withMessages([
                'otp_code' => FuelOpsClient::errorMessage($response, 'Invalid OTP code'),
            ]);
        }

        $this->session->signIn($signedIn['token'], $signedIn['user']);

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * @throws ValidationException
     */
    public function resend(): RedirectResponse
    {
        $challenge = $this->session->challenge();

        if ($challenge === null) {
            return redirect()->route('login')->with('status', self::EXPIRED_MESSAGE);
        }

        try {
            $response = $this->client->guest('POST', '/auth/resend-otp', ['challenge_token' => $challenge['token']]);
        } catch (ConnectionException) {
            throw ValidationException::withMessages(['otp_code' => LoginController::UNREACHABLE_MESSAGE]);
        }

        if ($response->status() !== 200) {
            throw ValidationException::withMessages([
                'otp_code' => FuelOpsClient::errorMessage($response, 'Failed to resend code'),
            ]);
        }

        return back()->with('status', 'New OTP code sent to your email');
    }

    /**
     * Drops the pending challenge when the user backs out, so the next sign-in starts a fresh one.
     */
    public function destroy(): RedirectResponse
    {
        $this->session->cancelChallenge();

        return redirect()->route('login');
    }
}
