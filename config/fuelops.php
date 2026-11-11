<?php

return [

    /*
    |--------------------------------------------------------------------------
    | FuelOps ERP API
    |--------------------------------------------------------------------------
    |
    | This application is a web front end for the FuelOps ERP: it owns no
    | business data of its own. Every screen reads and writes through the ERP's
    | mobile API (the same one the Star Technician mobile app uses), signed
    | with the bearer token the ERP issued when the user logged in.
    |
    */

    'base_url' => rtrim((string) env('FUELOPS_API_BASE_URL', 'https://erpstarv1.nxtremeprojectnew.com/api/v1'), '/'),

    'timeout' => (int) env('FUELOPS_API_TIMEOUT', 30),

    'connect_timeout' => (int) env('FUELOPS_API_CONNECT_TIMEOUT', 10),

    /*
    |--------------------------------------------------------------------------
    | Profile refresh interval
    |--------------------------------------------------------------------------
    |
    | Roles are changed on the ERP while a user stays signed in here, so the
    | signed-in user's profile is re-fetched on page visits once it is older
    | than this many seconds.
    |
    */

    'profile_refresh_seconds' => (int) env('FUELOPS_PROFILE_REFRESH_SECONDS', 60),

    /*
    |--------------------------------------------------------------------------
    | Gateway deny list
    |--------------------------------------------------------------------------
    |
    | API path prefixes the browser may not reach through the gateway. Session
    | endpoints are handled by this application's own controllers so the token
    | never leaves the server; device registration is mobile-push only.
    |
    */

    'gateway_denied_prefixes' => ['auth/', 'devices/'],

];
