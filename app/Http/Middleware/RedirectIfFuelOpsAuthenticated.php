<?php

namespace App\Http\Middleware;

use App\Services\FuelOps\FuelOpsSession;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RedirectIfFuelOpsAuthenticated
{
    public function __construct(private FuelOpsSession $session) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($this->session->isAuthenticated()) {
            return redirect()->route('dashboard');
        }

        return $next($request);
    }
}
