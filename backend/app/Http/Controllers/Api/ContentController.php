<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\Rating;
use App\Models\WorkOrder;
use App\Support\Input;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ContentController extends Controller
{
    // ---------- Blog (admin) ----------

    public function staffPosts(Request $request): JsonResponse
    {
        $query = Post::with('author')->orderByDesc('id');

        return response()->json($this->paginate($query, $request));
    }

    public function storePost(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:posts,slug',
            'excerpt' => 'nullable|string|max:500',
            'content' => 'required|string',
            'cover' => 'nullable|string|max:2048',
            'is_published' => 'nullable|boolean',
        ]);

        $post = Post::create([
            ...$validated,
            'excerpt' => Input::clean($validated['excerpt'] ?? null),
            'content' => $validated['content'],
            'user_id' => $request->user()->id,
            'published_at' => ! empty($validated['is_published']) ? now() : null,
        ]);

        return response()->json($post->load('author'), 201);
    }

    public function updatePost(Request $request, Post $post): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'slug' => 'nullable|string|max:255|unique:posts,slug,' . $post->id,
            'excerpt' => 'nullable|string|max:500',
            'content' => 'sometimes|string',
            'cover' => 'nullable|string|max:2048',
            'is_published' => 'nullable|boolean',
        ]);

        if (array_key_exists('excerpt', $validated)) {
            $validated['excerpt'] = Input::clean($validated['excerpt']);
        }
        if (array_key_exists('is_published', $validated)) {
            $validated['published_at'] = $validated['is_published'] ? ($post->published_at ?? now()) : null;
        }

        $post->update($validated);

        return response()->json($post->load('author'));
    }

    public function destroyPost(Request $request, Post $post): JsonResponse
    {
        $post->delete();

        return response()->json(['message' => 'Publicación eliminada']);
    }

    // ---------- Blog (público) ----------

    public function posts(Request $request): JsonResponse
    {
        $posts = Post::with('author')->where('is_published', true)
            ->orderByDesc('published_at')
            ->limit(min(50, (int) ($request->get('limit') ?? 20)))
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'title' => $p->title,
                'slug' => $p->slug,
                'excerpt' => $p->excerptText(),
                'cover' => $p->cover,
                'published_at' => $p->published_at?->toDateString(),
                'author' => $p->author?->name,
                'read_minutes' => $this->readMinutes($p->content),
            ]);

        return response()->json(['data' => $posts]);
    }

    public function postBySlug(string $slug): JsonResponse
    {
        $post = Post::with('author')->where('slug', $slug)->where('is_published', true)->firstOrFail();

        $related = Post::where('is_published', true)
            ->where('id', '!=', $post->id)
            ->orderByDesc('published_at')
            ->limit(3)
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'title' => $p->title,
                'slug' => $p->slug,
                'excerpt' => $p->excerptText(110),
                'cover' => $p->cover,
                'published_at' => $p->published_at?->toDateString(),
            ]);

        return response()->json([
            'id' => $post->id,
            'title' => $post->title,
            'slug' => $post->slug,
            'excerpt' => $post->excerpt,
            'content' => $post->content,
            'cover' => $post->cover,
            'published_at' => $post->published_at?->toDateString(),
            'author' => $post->author?->name,
            'read_minutes' => $this->readMinutes($post->content),
            'related' => $related,
        ]);
    }

    private function readMinutes(string $content): int
    {
        $words = str_word_count(strip_tags($content));
        return max(1, (int) round($words / 200));
    }

    // ---------- Valoraciones ----------

    public function storeRating(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'work_order_id' => 'required|exists:work_orders,id',
            'score' => 'required|integer|between:1,5',
            'comment' => 'nullable|string|max:1000',
        ]);

        $order = WorkOrder::findOrFail($validated['work_order_id']);

        if ($order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Esta orden no te pertenece'], 403);
        }
        if (! in_array($order->status, ['completed', 'delivered'], true)) {
            return response()->json(['message' => 'Solo puedes valorar órdenes entregadas'], 422);
        }

        $rating = Rating::updateOrCreate(
            ['work_order_id' => $order->id, 'user_id' => $request->user()->id],
            ['score' => $validated['score'], 'comment' => \App\Support\Input::clean($validated['comment'] ?? null)]
        );

        return response()->json($rating, 201);
    }

    public function staffRatings(Request $request): JsonResponse
    {
        $query = Rating::with(['user', 'workOrder'])
            ->orderByDesc('created_at');

        return response()->json($this->paginate($query, $request));
    }

    // ---------- Mensajes de contacto (paneko) ----------

    public function staffMessages(Request $request): JsonResponse
    {
        $query = \App\Models\ContactMessage::orderByDesc('created_at');

        if ($request->boolean('unread_only')) {
            $query->unread();
        }

        return response()->json($this->paginate($query, $request));
    }

    public function markMessageRead(Request $request, \App\Models\ContactMessage $message): JsonResponse
    {
        $message->update(['is_read' => true]);

        return response()->json($message);
    }

    public function destroyMessage(Request $request, \App\Models\ContactMessage $message): JsonResponse
    {
        $message->delete();

        return response()->json(['message' => 'Mensaje eliminado']);
    }

    // ---------- helper ----------

    private function paginate($query, Request $request): array
    {
        $perPage = min(50, max(1, (int) ($request->get('per_page') ?? 20)));
        $page = max(1, (int) ($request->get('page') ?? 1));
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        return [
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
            ],
        ];
    }
}
