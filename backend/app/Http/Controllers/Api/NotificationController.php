<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\Paginates;
use App\Models\AppNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    use Paginates;

    public function index(Request $request): JsonResponse
    {
        $query = AppNotification::where('user_id', $request->user()->id)
            ->orderByDesc('id');

        $total = $query->toBase()->getCountForPagination();
        $items = $query->forPage($this->page($request), $this->perPage($request))
            ->get()->map(fn ($n) => $this->serialize($n));

        return response()->json($this->paginatePayload($items, $this->page($request), $this->perPage($request), $total));
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $count = AppNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['count' => $count]);
    }

    public function markRead(Request $request, AppNotification $notification): JsonResponse
    {
        $this->authorizeOwnership($request, $notification);
        $notification->update(['read_at' => now()]);

        return response()->json($this->serialize($notification->fresh()));
    }

    public function markAllRead(Request $request): JsonResponse
    {
        AppNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'Todas marcadas como leídas']);
    }

    public function destroy(Request $request, AppNotification $notification): JsonResponse
    {
        $this->authorizeOwnership($request, $notification);
        $notification->delete();

        return response()->json(['message' => 'Notificación eliminada']);
    }

    private function serialize(AppNotification $n): array
    {
        return [
            'id' => $n->id,
            'type' => $n->type,
            'title' => $n->title,
            'message' => $n->message,
            'channel' => $n->channel,
            'wa_sent' => (bool) $n->wa_sent,
            'read' => ! is_null($n->read_at),
            'created_at' => $n->created_at?->toDateTimeString(),
        ];
    }

    private function authorizeOwnership(Request $request, AppNotification $notification): void
    {
        if ($notification->user_id !== $request->user()->id) {
            abort(403, 'No autorizado');
        }
    }
}