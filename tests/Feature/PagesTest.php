<?php

use App\Services\FuelOps\FuelOpsSession;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['fuelops.base_url' => 'https://erp.test/api/v1', 'inertia.testing.ensure_pages_exist' => true]);
    $this->withoutVite();
    app(FuelOpsSession::class)->signIn('erp-token', ['userId' => '7', 'fullName' => 'Ama Mensah', 'isClusterLeader' => true]);
});

test('every screen renders its page component', function (string $url, string $component) {
    $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page->component($component));
})->with([
    ['/dashboard', 'dashboard'],
    ['/notifications', 'notifications/index'],
    ['/tickets', 'tickets/index'],
    ['/tickets/create', 'tickets/create'],
    ['/projects', 'projects/index'],
    ['/special-assignments', 'special-assignments/index'],
    ['/special-assignments/create', 'special-assignments/create'],
    ['/compliance', 'compliance/index'],
    ['/requisitions', 'requisitions/index'],
    ['/requisitions/create', 'requisitions/create'],
    ['/inventory/requests', 'inventory/requests'],
    ['/inventory', 'inventory/stock'],
    ['/dispatch/queue', 'dispatch/queue'],
    ['/dispatch/covers', 'dispatch/covers'],
    ['/dispatch/report', 'dispatch/report'],
    ['/cluster/overview', 'cluster/overview'],
    ['/cluster/team-requests', 'cluster/inventory-approvals'],
    ['/cluster/mini-store', 'cluster/mini-store'],
    ['/cluster/job-cards', 'cluster/job-cards'],
    ['/operations/overview', 'operations/overview'],
    ['/technicians', 'technicians/index'],
    ['/reports', 'reports/index'],
    ['/location', 'location/index'],
    ['/profile', 'profile/index'],
    ['/settings/appearance', 'settings/appearance'],
]);

test('detail screens receive their record id', function () {
    $this->get('/tickets/TKT-12')->assertInertia(fn (Assert $page) => $page->component('tickets/show')->where('ticketId', 'TKT-12'));
    $this->get('/requisitions/42')->assertInertia(fn (Assert $page) => $page->component('requisitions/show')->where('requisitionId', '42'));
});
