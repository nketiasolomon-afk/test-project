<?php

namespace App\Services\FuelOps;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Session;

/**
 * The signed-in ERP user for this browser session.
 *
 * Users live on the FuelOps ERP, not in this application's database, so the
 * session holds the ERP's bearer token (encrypted, never sent to the browser)
 * and a copy of the user's profile.
 */
class FuelOpsSession
{
    private const TOKEN = 'fuelops.token';

    private const USER = 'fuelops.user';

    private const USER_FETCHED_AT = 'fuelops.user_fetched_at';

    private const CHALLENGE = 'fuelops.challenge';

    private const NOTICE = 'fuelops.notice';

    public function isAuthenticated(): bool
    {
        return $this->token() !== null;
    }

    public function token(): ?string
    {
        $encrypted = Session::get(self::TOKEN);

        if (! is_string($encrypted)) {
            return null;
        }

        try {
            return Crypt::decryptString($encrypted);
        } catch (DecryptException) {
            return null;
        }
    }

    public function setToken(string $token): void
    {
        Session::put(self::TOKEN, Crypt::encryptString($token));
    }

    /**
     * @return array{userId: string, fullName: string, username: string, role: string, isClusterLeader: bool, canDispatch: bool, clusterId: ?string, stationId: ?string, phone: ?string, email: ?string, profilePicUrl: ?string}|null
     */
    public function user(): ?array
    {
        $user = Session::get(self::USER);

        return is_array($user) ? $user : null;
    }

    /**
     * Stores the user's profile as the ERP sent it, tolerating camelCase or snake_case keys.
     *
     * @param  array<string, mixed>  $raw
     */
    public function setUser(array $raw): void
    {
        $string = fn (mixed $value): ?string => $value === null ? null : (string) $value;

        Session::put(self::USER, [
            'userId' => (string) ($raw['userId'] ?? $raw['user_id'] ?? ''),
            'fullName' => (string) ($raw['fullName'] ?? $raw['full_name'] ?? ''),
            'username' => (string) ($raw['username'] ?? ''),
            'role' => (string) ($raw['role'] ?? 'tech'),
            'isClusterLeader' => ($raw['isClusterLeader'] ?? $raw['is_cluster_leader'] ?? false) === true,
            'canDispatch' => ($raw['canDispatch'] ?? $raw['can_dispatch'] ?? false) === true,
            'clusterId' => $string($raw['clusterId'] ?? $raw['cluster_id'] ?? null),
            'stationId' => $string($raw['stationId'] ?? $raw['station_id'] ?? null),
            'phone' => $string($raw['phone'] ?? null),
            'email' => $string($raw['email'] ?? null),
            'profilePicUrl' => $string($raw['profilePicUrl'] ?? $raw['profile_pic_url'] ?? null),
        ]);
        Session::put(self::USER_FETCHED_AT, now()->getTimestamp());
    }

    public function userIsStale(): bool
    {
        $fetchedAt = (int) Session::get(self::USER_FETCHED_AT, 0);

        return now()->getTimestamp() - $fetchedAt >= config('fuelops.profile_refresh_seconds');
    }

    /**
     * Records that a profile refresh was attempted, so a failing ERP isn't retried on every page.
     */
    public function markUserChecked(): void
    {
        Session::put(self::USER_FETCHED_AT, now()->getTimestamp());
    }

    /**
     * Starts the signed-in session from a sign-in response's token and user.
     *
     * @param  array<string, mixed>  $user
     */
    public function signIn(string $token, array $user): void
    {
        Session::regenerate();
        Session::forget(self::CHALLENGE);
        $this->setToken($token);
        $this->setUser($user);
    }

    /**
     * Ends the signed-in session, optionally leaving a message for the login page.
     */
    public function signOut(?string $notice = null): void
    {
        Session::forget([self::TOKEN, self::USER, self::USER_FETCHED_AT, self::CHALLENGE]);

        if ($notice !== null) {
            Session::put(self::NOTICE, $notice);
        }
    }

    /**
     * The pending OTP challenge from a password login, if the ERP asked for one.
     *
     * @return array{token: string, username: string}|null
     */
    public function challenge(): ?array
    {
        $challenge = Session::get(self::CHALLENGE);

        return is_array($challenge) ? $challenge : null;
    }

    public function startChallenge(string $challengeToken, string $username): void
    {
        Session::put(self::CHALLENGE, ['token' => $challengeToken, 'username' => $username]);
    }

    public function cancelChallenge(): void
    {
        Session::forget(self::CHALLENGE);
    }

    public function pullNotice(): ?string
    {
        $notice = Session::pull(self::NOTICE);

        return is_string($notice) ? $notice : null;
    }
}
