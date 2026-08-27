<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CatalogController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ContentController;
use App\Http\Controllers\Api\FinanceController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\MotorcycleController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PublicController;
use App\Http\Controllers\Api\StaffCatalogController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\StoreController;
use Illuminate\Support\Facades\Route;

// Ruta "login" para que el middleware de autenticación pueda redirigir sin lanzar "Route [login] not defined"
// (esto causaba 500/502 cuando una sesión expiraba y se consultaba un endpoint protegido).
Route::name('login')->get('login', fn () => response()->json(['message' => 'No autenticado'], 401));

Route::prefix('v1')->group(function () {
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:6,60');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:10,60');
    Route::post('password/forgot', [AuthController::class, 'forgotPassword'])->middleware('throttle:6,60');
    Route::post('password/reset', [AuthController::class, 'resetPassword'])->middleware('throttle:6,60');

    Route::get('brands', [CatalogController::class, 'brands']);
    Route::get('brands/{brandId}/models', [CatalogController::class, 'models']);

    Route::get('categories', [PublicController::class, 'categories']);
    Route::get('services', [PublicController::class, 'services']);
    Route::get('site-info', [PublicController::class, 'siteInfo']);
    Route::get('home-data', [PublicController::class, 'homeData']);
    Route::get('payment-info', [PublicController::class, 'paymentInfo']);
    Route::get('team', [PublicController::class, 'team']);
    Route::post('contact', [PublicController::class, 'contact'])->middleware('throttle:10,1');
    Route::post('store/checkout-guest', [StoreController::class, 'checkoutGuest'])->middleware('throttle:10,1');
Route::get('products', [PublicController::class, 'products']);
    Route::get('store/filters', [PublicController::class, 'storeFilters']);
            Route::get('products/{slug}', [PublicController::class, 'productBySlug']);
    Route::post('appointments', [PublicController::class, 'storeAppointment'])->middleware('throttle:10,1');
    Route::get('appointments/queue', [PublicController::class, 'appointmentQueue']);
    Route::post('orders/track', [PublicController::class, 'trackOrder'])->middleware('throttle:30,1');
    Route::get('blog', [ContentController::class, 'posts']);
    Route::get('blog/{slug}', [ContentController::class, 'postBySlug']);
    Route::get('shared-favorites/{token}', [PublicController::class, 'sharedFavorites']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('user', [AuthController::class, 'user']);
        Route::patch('user', [AuthController::class, 'updateUser']);
        Route::post('user/photo', [AuthController::class, 'uploadPhoto'])->middleware('throttle:5,60');
        Route::post('logout', [AuthController::class, 'logout']);

        Route::get('dashboard', [ClientController::class, 'dashboard']);
        Route::post('request-service', [ClientController::class, 'requestService']);
        Route::get('motorcycles/{motorcycle}/history', [ClientController::class, 'motorcycleHistory']);
        Route::post('store/checkout', [StoreController::class, 'checkout'])->middleware('throttle:5,60');
        Route::get('store/recommended', [StoreController::class, 'recommended']);
        Route::get('favorites', [StoreController::class, 'favorites']);
        Route::post('favorites/toggle', [StoreController::class, 'toggleFavorite']);
        Route::delete('favorites/{product}', [StoreController::class, 'removeFavorite']);
        Route::post('favorites/clear', [StoreController::class, 'clearFavorites']);
        Route::post('favorites/{product}/stock-alert', [StoreController::class, 'toggleStockAlert']);
        Route::post('favorites/{product}/price-alert', [StoreController::class, 'setPriceAlert']);
        Route::delete('favorites/{product}/price-alert', [StoreController::class, 'removePriceAlert']);
        Route::get('favorites/{product}/price-history', [StoreController::class, 'priceHistory']);
        Route::get('favorites/{product}/compare', [StoreController::class, 'compare']);
        Route::post('favorites/share', [StoreController::class, 'share']);
        Route::post('store/validate-coupon', [StoreController::class, 'validateCoupon']);

        Route::get('notifications', [NotificationController::class, 'index']);
        Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('notifications/{notification}/read', [NotificationController::class, 'markRead']);
        Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);
        Route::delete('notifications/{notification}', [NotificationController::class, 'destroy']);

        Route::apiResource('motorcycles', MotorcycleController::class);
        Route::post('motorcycles/{motorcycle}/photo', [MotorcycleController::class, 'uploadPhoto']);

        Route::get('my-orders', [OrderController::class, 'myOrders']);
        Route::get('my-orders/calendar', [OrderController::class, 'myCalendar']);
        Route::get('orders/{order}', [OrderController::class, 'show']);
        Route::get('orders/{order}/photos', [StaffController::class, 'listPhotos']);
        Route::get('orders/{order}/quotations', [OrderController::class, 'quotationHistory']);
        Route::post('orders/{order}/respond', [OrderController::class, 'respondQuotation']);
        Route::delete('orders/{order}', [OrderController::class, 'cancelOwnOrder']);
Route::get('orders/{order}/quotation/pdf', [OrderController::class, 'quotationPdf']);

        Route::prefix('staff')->middleware('role:admin,receptionist,mechanic')->group(function () {
            Route::get('orders/{order}/quotations', [OrderController::class, 'quotationHistory']);
        });

        Route::get('my-invoices', [InvoiceController::class, 'myInvoices']);
        Route::get('my-invoices/export', [InvoiceController::class, 'exportCsv']);
        Route::get('my-timeline', [InvoiceController::class, 'myTimeline']);
        Route::get('my-timeline/export', [InvoiceController::class, 'timelineExport']);
        Route::get('invoices/{invoice}', [InvoiceController::class, 'show']);
        Route::get('invoices/{invoice}/pdf', [InvoiceController::class, 'downloadPdf']);
        Route::get('invoices/{invoice}/invoice-pdf', [InvoiceController::class, 'downloadInvoicePdf']);
        Route::post('invoices/{invoice}/proof', [InvoiceController::class, 'uploadProof']);
        Route::post('invoices/{invoice}/cancel', [InvoiceController::class, 'cancelShopOrder']);
        Route::get('my-points', [InvoiceController::class, 'myPoints']);
        Route::post('points/redeem', [InvoiceController::class, 'redeemPoints']);
        Route::get('my-warranties', [InvoiceController::class, 'warranties']);
        Route::get('warranties/{warranty}/pdf', [InvoiceController::class, 'warrantyPdf']);
        Route::post('ratings', [ContentController::class, 'storeRating']);

        Route::get('chat', [ChatController::class, 'clientThread']);
        Route::post('chat', [ChatController::class, 'clientSend'])->middleware('throttle:30,60');
        Route::post('chat/read', [ChatController::class, 'clientMarkRead']);
        Route::get('chat/unread-count', [ChatController::class, 'clientUnreadCount']);
    });

    Route::prefix('staff')
        ->middleware(['auth:sanctum', 'role:admin,receptionist,mechanic'])
        ->group(function () {
            Route::get('dashboard', [StaffController::class, 'dashboard'])->middleware('role:admin');
            Route::get('maintenance-alerts', [StaffController::class, 'maintenanceAlerts'])->middleware('role:admin');
            Route::get('audit-log', [StaffController::class, 'auditLog'])->middleware('role:admin');
            Route::get('agenda', [StaffController::class, 'workshopAgenda'])->middleware('role:admin');
            Route::get('calendar', [StaffController::class, 'calendar']);
            Route::get('orders', [StaffController::class, 'listOrders']);
            Route::get('services', [StaffCatalogController::class, 'services']);
            Route::post('orders', [StaffController::class, 'createOrder'])->middleware('role:admin,receptionist');
            Route::get('clients', [StaffController::class, 'listClients'])->middleware('role:admin,receptionist');
            Route::get('clients/{client}', [StaffController::class, 'clientDetail'])->middleware('role:admin,receptionist');
            Route::post('clients', [StaffController::class, 'storeClient'])->middleware('role:admin,receptionist');
            Route::patch('clients/{user}', [StaffController::class, 'updateClient'])->middleware('role:admin,receptionist');
            Route::delete('clients/{user}', [StaffController::class, 'deleteClient'])->middleware('role:admin,receptionist');
            Route::get('motorcycles', [StaffController::class, 'listMotorcycles'])->middleware('role:admin,receptionist');
            Route::get('appointments', [StaffController::class, 'appointments'])->middleware('role:admin,receptionist');
            Route::post('appointments/create', [StaffController::class, 'storeAppointment'])->middleware('role:admin,receptionist');
            Route::patch('appointments/{appointment}', [StaffController::class, 'updateAppointment'])->middleware('role:admin,receptionist');
              Route::delete('appointments/{appointment}', [StaffController::class, 'deleteAppointment'])->middleware('role:admin,receptionist');
            Route::get('inventory', [StaffController::class, 'inventory'])->middleware('role:admin');
            Route::patch('inventory/{product}', [StaffController::class, 'updateStock'])->middleware('role:admin');
            Route::get('inventory/{product}/movements', [StaffController::class, 'stockMovements'])->middleware('role:admin');

            Route::post('orders/{order}/assign', [StaffController::class, 'assignMechanic'])->middleware('role:admin');
            Route::post('orders/{order}/start', [StaffController::class, 'startWork'])->middleware('role:admin,mechanic');
            Route::post('orders/{order}/quotation', [StaffController::class, 'submitDiagnosisAndQuotation'])->middleware('role:admin,mechanic');
            Route::post('orders/{order}/photos', [StaffController::class, 'uploadPhoto'])->middleware('role:admin,mechanic');
            Route::patch('orders/{order}/status', [StaffController::class, 'updateStatus'])->middleware('role:admin,receptionist,mechanic');
            Route::post('orders/{order}/invoice', [InvoiceController::class, 'generateFromOrder'])->middleware('role:admin,receptionist');

            // Pagos / abonos / deudores
            Route::post('invoices/{invoice}/payment', [InvoiceController::class, 'registerPayment'])->middleware('role:admin,receptionist');
            Route::get('invoices/{invoice}/payments', [InvoiceController::class, 'invoicePayments'])->middleware('role:admin,receptionist');
            Route::get('debtors', [FinanceController::class, 'debtors'])->middleware('role:admin,receptionist');

            // Pedidos de tienda
            Route::get('shop-orders', [InvoiceController::class, 'shopOrders'])->middleware('role:admin,receptionist');
            Route::patch('invoices/{invoice}/order-status', [InvoiceController::class, 'updateShopOrderStatus'])->middleware('role:admin,receptionist');
            Route::post('invoices/{invoice}/invoice-pdf', [InvoiceController::class, 'uploadInvoicePdf'])->middleware('role:admin,receptionist');

            Route::get('warranties', [InvoiceController::class, 'warranties'])->middleware('role:admin,receptionist');
            Route::post('warranties', [InvoiceController::class, 'createWarranty'])->middleware('role:admin,mechanic');
            Route::get('invoices', [InvoiceController::class, 'myInvoices'])->middleware('role:admin');

            Route::get('staff', [StaffController::class, 'staff'])->middleware('role:admin');
            Route::post('staff', [StaffController::class, 'storeStaff'])->middleware('role:admin');
            Route::patch('staff/{user}', [StaffController::class, 'updateStaff'])->middleware('role:admin');
            Route::delete('staff/{user}', [StaffController::class, 'deleteStaff'])->middleware('role:admin');
            Route::post('staff/{user}/photo', [StaffController::class, 'uploadStaffPhoto'])->middleware('role:admin');

            Route::get('sales', [FinanceController::class, 'sales'])->middleware('role:admin');
            Route::post('sales', [FinanceController::class, 'storeSale'])->middleware('role:admin,receptionist');
            Route::get('sales/{invoice}/pdf', [InvoiceController::class, 'staffSalePdf'])->middleware('role:admin,receptionist');
            Route::get('sales/clients', [FinanceController::class, 'saleClients'])->middleware('role:admin,receptionist');
            Route::patch('sales/{invoice}', [FinanceController::class, 'updateSale'])->middleware('role:admin,receptionist');
            Route::delete('sales/{invoice}', [FinanceController::class, 'deleteSale'])->middleware('role:admin,receptionist');
            Route::get('reports', [FinanceController::class, 'reports'])->middleware('role:admin');
            Route::get('cash', [FinanceController::class, 'cashSessions'])->middleware('role:admin,receptionist');
Route::post('cash/open', [FinanceController::class, 'openCash'])->middleware('role:admin,receptionist');
            Route::post('cash/{session}/close', [FinanceController::class, 'closeCash'])->middleware('role:admin,receptionist');
            Route::get('cash/payments', [FinanceController::class, 'cashPayments'])->middleware('role:admin,receptionist');
            Route::patch('cash/payments/{payment}', [FinanceController::class, 'updatePayment'])->middleware('role:admin,receptionist');
            Route::delete('cash/payments/{payment}', [FinanceController::class, 'deletePayment'])->middleware('role:admin,receptionist');
Route::get('suppliers', [FinanceController::class, 'suppliers'])->middleware('role:admin');
            Route::post('suppliers', [FinanceController::class, 'storeSupplier'])->middleware('role:admin');
            Route::patch('suppliers/{supplier}', [FinanceController::class, 'updateSupplier'])->middleware('role:admin');
            Route::delete('suppliers/{supplier}', [FinanceController::class, 'deleteSupplier'])->middleware('role:admin');
            Route::get('purchases', [FinanceController::class, 'purchases'])->middleware('role:admin');
            Route::post('purchases', [FinanceController::class, 'storePurchase'])->middleware('role:admin');
            Route::patch('purchases/{purchase}', [FinanceController::class, 'updatePurchase'])->middleware('role:admin');
            Route::delete('purchases/{purchase}', [FinanceController::class, 'deletePurchase'])->middleware('role:admin');
            Route::get('settings', [FinanceController::class, 'settings'])->middleware('role:admin');
            Route::post('settings', [FinanceController::class, 'updateSettings'])->middleware('role:admin');
            Route::post('settings/upload', [FinanceController::class, 'uploadSettingImage'])->middleware('role:admin', 'throttle:10,60');

            Route::post('maintenance-rules', [FinanceController::class, 'storeMaintenanceRule'])->middleware('role:admin');
            Route::patch('maintenance-rules/{rule}', [FinanceController::class, 'updateMaintenanceRule'])->middleware('role:admin');
            Route::delete('maintenance-rules/{rule}', [FinanceController::class, 'deleteMaintenanceRule'])->middleware('role:admin');

            Route::get('backup', [FinanceController::class, 'backupDatabase'])->middleware('role:admin');
            Route::post('backup/restore', [FinanceController::class, 'restoreBackup'])->middleware('role:admin', 'throttle:3,60');
            Route::post('reset-database', [FinanceController::class, 'resetDatabase'])->middleware('role:admin', 'throttle:1,60');

            Route::get('posts', [ContentController::class, 'staffPosts'])->middleware('role:admin');
            Route::post('posts', [ContentController::class, 'storePost'])->middleware('role:admin');
            Route::patch('posts/{post}', [ContentController::class, 'updatePost'])->middleware('role:admin');
            Route::delete('posts/{post}', [ContentController::class, 'destroyPost'])->middleware('role:admin');
            Route::get('ratings', [ContentController::class, 'staffRatings'])->middleware('role:admin');
            Route::get('messages', [ContentController::class, 'staffMessages'])->middleware('role:admin,receptionist');
            Route::patch('messages/{message}/read', [ContentController::class, 'markMessageRead'])->middleware('role:admin,receptionist');
            Route::delete('messages/{message}', [ContentController::class, 'destroyMessage'])->middleware('role:admin,receptionist');

            Route::get('chat', [ChatController::class, 'staffConversations'])->middleware('role:admin,receptionist');
            Route::get('chat/{client}', [ChatController::class, 'staffThread'])->middleware('role:admin,receptionist');
            Route::post('chat/{client}', [ChatController::class, 'staffSend'])->middleware('role:admin,receptionist');
            Route::post('chat/{client}/read', [ChatController::class, 'staffMarkRead'])->middleware('role:admin,receptionist');

            // Catálogo / tienda (admin)
            Route::prefix('catalog')->middleware('role:admin')->group(function () {
                Route::get('services', [StaffCatalogController::class, 'services']);
                Route::post('services', [StaffCatalogController::class, 'storeService']);
                Route::patch('services/{service}', [StaffCatalogController::class, 'updateService']);
                Route::delete('services/{service}', [StaffCatalogController::class, 'deleteService']);

                Route::get('brands', [StaffCatalogController::class, 'brands']);
                Route::post('brands', [StaffCatalogController::class, 'storeBrand']);
                Route::patch('brands/{brand}', [StaffCatalogController::class, 'updateBrand']);
                Route::delete('brands/{brand}', [StaffCatalogController::class, 'deleteBrand']);

                Route::get('models', [StaffCatalogController::class, 'models']);
                Route::post('models', [StaffCatalogController::class, 'storeModel']);
                Route::patch('models/{model}', [StaffCatalogController::class, 'updateModel']);
                Route::delete('models/{model}', [StaffCatalogController::class, 'deleteModel']);

                Route::get('categories', [StaffCatalogController::class, 'categories']);
                Route::post('categories', [StaffCatalogController::class, 'storeCategory']);
                Route::patch('categories/{category}', [StaffCatalogController::class, 'updateCategory']);
                Route::delete('categories/{category}', [StaffCatalogController::class, 'deleteCategory']);

                Route::get('products', [StaffCatalogController::class, 'products']);
                Route::post('products', [StaffCatalogController::class, 'storeProduct']);
                Route::patch('products/{product}', [StaffCatalogController::class, 'updateProduct']);
                Route::delete('products/{product}', [StaffCatalogController::class, 'deleteProduct']);
            });
        });
});


