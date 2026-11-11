<?php

namespace App\Http\Controllers;

use App\Http\Middleware\EnsureFuelOpsAuthenticated;
use App\Services\FuelOps\FuelOpsClient;
use App\Services\FuelOps\FuelOpsSession;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Forwards the browser's API calls to the FuelOps ERP as the signed-in user.
 *
 * The pages talk to the ERP the same way the mobile app does, but through this
 * gateway, so the ERP token stays in the server-side session and the browser
 * only ever holds this application's session cookie.
 */
class FuelOpsGatewayController extends Controller
{
    public function __construct(private FuelOpsClient $client, private FuelOpsSession $session) {}

    public function __invoke(Request $request, string $path): Response
    {
        abort_if(Str::startsWith($path.'/', config('fuelops.gateway_denied_prefixes')), 404);

        try {
            $response = $this->client->send(
                $request->method(),
                $path,
                fn (): array => $this->options($request),
                array_filter(['Idempotency-Key' => $request->header('Idempotency-Key')]),
            );
        } catch (ConnectionException) {
            return response()->json([
                'message' => 'Could not reach the server. Please check your connection and try again.',
                'code' => 'upstream_unreachable',
            ], 503);
        }

        if ($response->status() === 401) {
            $this->session->signOut(EnsureFuelOpsAuthenticated::SESSION_EXPIRED_MESSAGE);

            return response()->json([
                'message' => EnsureFuelOpsAuthenticated::SESSION_EXPIRED_MESSAGE,
                'code' => 'session_expired',
            ], 401);
        }

        if (FuelOpsClient::roleWasRevoked($response)) {
            $this->session->signOut(FuelOpsClient::errorMessage($response, 'Your role can no longer use the app.'));
        }

        if ($path === 'users/profile' && $response->successful() && is_array($response->json('user'))) {
            $this->session->setUser($response->json('user'));
        }

        return response($response->body(), $response->status())
            ->header('Content-Type', $response->header('Content-Type') ?: 'application/json');
    }

    /**
     * Guzzle options carrying the browser's query string and body through unchanged.
     *
     * @return array<string, mixed>
     */
    private function options(Request $request): array
    {
        $options = ['query' => $request->query()];

        if ($request->isMethod('GET')) {
            return $options;
        }

        if ($request->allFiles() !== [] || Str::startsWith((string) $request->header('Content-Type'), 'multipart/form-data')) {
            $options['multipart'] = [
                ...$this->fieldParts($request->post()),
                ...$this->fileParts($request->allFiles()),
            ];
        } elseif ($request->getContent() !== '') {
            $options['body'] = $request->getContent();
        }

        return $options;
    }

    /**
     * @param  array<string, mixed>  $fields
     * @return list<array{name: string, contents: string}>
     */
    private function fieldParts(array $fields, string $prefix = ''): array
    {
        $parts = [];

        foreach ($fields as $key => $value) {
            $name = $prefix === '' ? (string) $key : "{$prefix}[{$key}]";

            if (is_array($value)) {
                array_push($parts, ...$this->fieldParts($value, $name));
            } elseif ($value !== null) {
                $parts[] = ['name' => $name, 'contents' => (string) $value];
            }
        }

        return $parts;
    }

    /**
     * @param  array<string, mixed>  $files
     * @return list<array{name: string, contents: resource, filename: string}>
     */
    private function fileParts(array $files, string $prefix = ''): array
    {
        $parts = [];

        foreach ($files as $key => $file) {
            $name = $prefix === '' ? (string) $key : "{$prefix}[{$key}]";

            if (is_array($file)) {
                array_push($parts, ...$this->fileParts($file, $name));
            } elseif ($file instanceof UploadedFile && $file->isValid()) {
                $parts[] = [
                    'name' => $name,
                    'contents' => fopen($file->getRealPath(), 'r'),
                    'filename' => $file->getClientOriginalName(),
                ];
            }
        }

        return $parts;
    }
}
