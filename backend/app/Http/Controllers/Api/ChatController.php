<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\User;
use App\Support\Input;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    public function clientThread(Request $request): JsonResponse
    {
        $messages = ChatMessage::with('staff:id,name')
            ->where('user_id', $request->user()->id)
            ->orderBy('created_at')
            ->get()
            ->map(fn (ChatMessage $m) => $this->serialize($m));

        return response()->json($messages);
    }

    public function clientSend(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => 'required|string|max:2000',
        ]);

        $message = ChatMessage::create([
            'user_id' => $request->user()->id,
            'sender' => 'client',
            'message' => Input::clean($validated['message']),
            'is_read' => false,
        ]);

        return response()->json($this->serialize($message->load('staff:id,name')), 201);
    }

    public function clientMarkRead(Request $request): JsonResponse
    {
        ChatMessage::where('user_id', $request->user()->id)
            ->where('sender', 'staff')
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json(['ok' => true]);
    }

    public function clientUnreadCount(Request $request): JsonResponse
    {
        $count = ChatMessage::where('user_id', $request->user()->id)
            ->where('sender', 'staff')
            ->where('is_read', false)
            ->count();

        return response()->json(['count' => $count]);
    }

    public function staffConversations(Request $request): JsonResponse
    {
        $conversations = ChatMessage::with('user:id,name,email,phone,photo')
            ->select('user_id', \Illuminate\Support\Facades\DB::raw('MAX(id) as last_id'))
            ->groupBy('user_id')
            ->orderByDesc('last_id')
            ->get()
            ->map(function ($group) {
                $last = ChatMessage::with('user:id,name,email,phone,photo')
                    ->where('user_id', $group->user_id)
                    ->latest()
                    ->first();

                $unread = ChatMessage::where('user_id', $group->user_id)
                    ->where('sender', 'client')
                    ->where('is_read', false)
                    ->count();

                return [
                    'user' => [
                        'id' => $last->user->id,
                        'name' => $last->user->name,
                        'email' => $last->user->email,
                        'phone' => $last->user->phone,
                        'photo' => $last->user->photo,
                    ],
                    'last_message' => $last->message,
                    'last_sender' => $last->sender,
                    'last_at' => $last->created_at?->toDateTimeString(),
                    'unread' => $unread,
                ];
            })
            ->values();

        return response()->json($conversations);
    }

    public function staffThread(Request $request, User $client): JsonResponse
    {
        abort_if($client->role !== 'customer', 422, 'Solo se puede conversar con clientes.');

        $messages = ChatMessage::with('staff:id,name')
            ->where('user_id', $client->id)
            ->orderBy('created_at')
            ->get()
            ->map(fn (ChatMessage $m) => $this->serialize($m));

        return response()->json($messages);
    }

    public function staffSend(Request $request, User $client): JsonResponse
    {
        abort_if($client->role !== 'customer', 422, 'Solo se puede conversar con clientes.');

        $validated = $request->validate([
            'message' => 'required|string|max:2000',
        ]);

        $message = ChatMessage::create([
            'user_id' => $client->id,
            'sender' => 'staff',
            'staff_id' => $request->user()->id,
            'message' => Input::clean($validated['message']),
            'is_read' => false,
        ]);

        return response()->json($this->serialize($message->load('staff:id,name')), 201);
    }

    public function staffMarkRead(Request $request, User $client): JsonResponse
    {
        ChatMessage::where('user_id', $client->id)
            ->where('sender', 'client')
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json(['ok' => true]);
    }

    private function serialize(ChatMessage $m): array
    {
        return [
            'id' => $m->id,
            'sender' => $m->sender,
            'staff' => $m->staff ? [
                'id' => $m->staff->id,
                'name' => $m->staff->name,
            ] : null,
            'message' => $m->message,
            'is_read' => $m->is_read,
            'created_at' => $m->created_at?->toDateTimeString(),
        ];
    }
}