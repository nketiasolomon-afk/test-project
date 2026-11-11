<?php

namespace App\Http\Middleware;

use App\Services\FuelOps\FuelOpsClient;
use App\Services\FuelOps\FuelOpsSession;
use Closure;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureFuelOpsAuthenticated
{
    public const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

    public function __construct(private FuelOpsSession $session, private FuelOpsClient $client) {}

    /**
     * Requires an ERP session. Pass "api" for JSON endpoints, which answer 401 instead of redirecting.
     */
    public function handle(Request $request, Closure $next, string $mode = 'page'): Response
    {
        if (! $this->session->isAuthenticated()) {
            return $this->unauthenticated($request, $mode);
        }

        if ($mode === 'page' && $request->isMethod('GET') && $this->session->userIsStale()) {
            $this->refreshUser();

            if (! $this->session->isAuthenticated()) {
                return $this->unauthenticated($request, $mode);
            }
        }

        return $next($request);
    }

    /**
     * Re-fetches the user's profile so a role changed on the ERP reaches this session.
     * Best-effort: an unreachable ERP leaves the session as it was.
     */
    private function refreshUser(): void
    {
        $this->session->markUserChecked();

        try {
            $response = $this->client->send('GET', '/auth/me');
        } catch (ConnectionException) {
            return;
        }

        if ($response->ok() && is_array($response->json('user'))) {
            $this->session->setUser($response->json('user'));
        } elseif (FuelOpsClient::roleWasRevoked($response)) {
            $this->session->signOut(FuelOpsClient::errorMessage($response, 'Your role can no longer use the app.'));
        } elseif ($response->status() === 401) {
            $this->session->signOut(self::SESSION_EXPIRED_MESSAGE);
        }
    }

    private function unauthenticated(Request $request, string $mode): Response
    {
        if ($mode === 'api') {
            return response()->json(['message' => self::SESSION_EXPIRED_MESSAGE, 'code' => 'session_expired'], 401);
        }

        return redirect()->guest(route('login'));
    }
}
