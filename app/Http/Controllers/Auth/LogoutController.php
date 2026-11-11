<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\FuelOps\FuelOpsClient;
use App\Services\FuelOps\FuelOpsSession;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class LogoutController extends Controller
{
    public function __invoke(Request $request, FuelOpsClient $client, FuelOpsSession $session): RedirectResponse
    {
        try {
            $client->send('POST', '/auth/logout', refreshOnUnauthorized: false);
        } catch (ConnectionException) {
            // The ERP token is dropped locally either way; logging out must not depend on the ERP.
        }

        $session->signOut();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
