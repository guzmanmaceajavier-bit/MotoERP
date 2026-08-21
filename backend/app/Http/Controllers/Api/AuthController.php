<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\NotificationService;
use App\Support\Input;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    private const MAX_ATTEMPTS = 5;

    private const LOCKOUT_MINUTES = 5;

    public function __construct(private NotificationService $notifications) {}

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:30',
            'password' => 'required|string|min:8',
        ]);

        $user = User::create([
            'name' => Input::clean($validated['name']),
            'email' => $validated['email'],
            'phone' => Input::clean($validated['phone'] ?? null),
            'role' => 'customer',
            'password' => Hash::make($validated['password']),
        ]);

        $token = $user->createToken('moto-app')->plainTextToken;

        return response()->json([
            'message' => 'Usuario registrado',
            'user' => $user,
            'token' => $token,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $key = $this->lockKey($validated['email']);

        // El usuario quedó bloqueado tras varios intentos fallidos.
        if ($remaining = $this->lockRemaining($key)) {
            return response()->json([
                'message' => 'Demasiados intentos fallidos. Vuelve a intentarlo en '.ceil($remaining / 60).' minuto(s).',
                'retry_in_seconds' => (int) $remaining,
            ], 429);
        }

        $user = User::where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            $this->registerFailure($key);

            if ($this->lockRemaining($key)) {
                return response()->json([
                    'message' => 'Demasiados intentos fallidos. Cuenta bloqueada por '.self::LOCKOUT_MINUTES.' minutos.',
                    'retry_in_seconds' => self::LOCKOUT_MINUTES * 60,
                ], 429);
            }

            return response()->json(['message' => 'Credenciales inválidas'], 401);
        }

        $this->clearLoginState($validated['email']);
        $token = $user->createToken('moto-app')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    /**
     * Pide un código de recuperación por WhatsApp para restablecer la contraseña.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('email', $validated['email'])->first();

        // Respuesta idéntica exista o no la cuenta, para no filtrar usuarios.
        if (! $user) {
            return response()->json(['message' => 'Si el correo está registrado, se enviará el código por WhatsApp.']);
        }

        $code = (string) random_int(100000, 999999);

        Cache::put($this->resetKey($user->email), [
            'code' => Hash::make($code),
        ], now()->addMinutes(self::LOCKOUT_MINUTES));

        $sent = $this->notifications->sendRecoveryCode($user->phone, $code);

        $response = [
            'message' => 'Si el correo está registrado, se enviaremos el código por WhatsApp.',
            'whatsapp_sent' => $sent,
        ];

        // Sin WhatsApp configurado aún: entregamos el código por el log para
        // poder probar el flujo completo en desarrollo.
        if (! $sent && (bool) config('app.debug')) {
            Log::warning("Código de recuperación para {$user->email}: {$code}");
            $response['debug_code'] = $code;
        }

        return response()->json($response);
    }

    /**
     * Valida el código y restablece la contraseña.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'code' => 'required|digits:6',
            'password' => 'required|string|min:8',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (! $user) {
            return response()->json(['message' => 'Código inválido o expirado'], 422);
        }

        $stored = Cache::get($this->resetKey($user->email));

        if (! $stored || ! Hash::check($validated['code'], $stored['code'])) {
            return response()->json(['message' => 'Código inválido o expirado'], 422);
        }

        Cache::forget($this->resetKey($user->email));
        $this->clearLoginState($user->email);

        $user->password = Hash::make($validated['password']);
        $user->save();
        $user->tokens()->delete();

        return response()->json(['message' => 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.']);
    }

    private function lockKey(string $email): string
    {
        return 'login_lock:'.request()->ip().'|'.\strtolower($email);
    }

    private function resetKey(string $email): string
    {
        return 'password_reset_code:'.\strtolower($email);
    }

    private function lockRemaining(string $key): ?int
    {
        $until = Cache::get('login_blocked:'.$key);

        if (! $until) {
            return null;
        }

        $remaining = $until - time();

        return $remaining > 0 ? $remaining : null;
    }

    private function registerFailure(string $key): void
    {
        $countKey = 'login_fails:'.$key;
        $count = (int) Cache::get($countKey, 0) + 1;

        if ($count >= self::MAX_ATTEMPTS) {
            Cache::put('login_blocked:'.$key, now()->addMinutes(self::LOCKOUT_MINUTES)->timestamp, now()->addMinutes(self::LOCKOUT_MINUTES));
            Cache::forget($countKey);

            return;
        }

        Cache::put($countKey, $count, now()->addMinutes(self::LOCKOUT_MINUTES));
    }

    private function clearLoginState(string $email): void
    {
        $key = $this->lockKey($email);
        Cache::forget('login_fails:'.$key);
        Cache::forget('login_blocked:'.$key);
    }

    public function user(Request $request): JsonResponse
    {
        return response()->json($request->user()->load('motorcycles'));
    }

    public function updateUser(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,'.$user->id,
            'phone' => 'nullable|string|max:30',
            'specialty' => 'nullable|string|max:255',
            'bio' => 'nullable|string|max:1000',
            'password' => 'nullable|string|min:8',
            'current_password' => 'required_with:password|string',
        ]);

        if (! empty($validated['password'])) {
            if (! Hash::check($validated['current_password'], $user->password)) {
                return response()->json(['message' => 'La contraseña actual es incorrecta'], 422);
            }
            $user->password = Hash::make($validated['password']);
        }

        $user->fill(Input::cleanArray(
            \collect($validated)->only(['name', 'email', 'phone', 'specialty', 'bio'])->all(),
            ['email']
        ));
        $user->save();

        $user->refresh();

        if (isset($validated['password'])) {
            // Conserva el token de la sesión actual y solo revoca las demás
            // sesiones del usuario (p. ej. otros dispositivos o el otro panel),
            // evitando que este panel cierre sesión al cambiar la contraseña.
            $currentTokenId = $request->user()?->currentAccessToken()?->id;

            $user->tokens()
                ->when($currentTokenId, fn ($q) => $q->where('id', '!=', $currentTokenId))
                ->delete();

            $token = $user->createToken('moto-app')->plainTextToken;

            return response()->json(['user' => $user, 'token' => $token]);
        }

        return response()->json(['user' => $user]);
    }

    /**
     * Sube y actualiza la foto de perfil del cliente autenticado.
     */
    public function uploadPhoto(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'photo' => 'required|image|max:5120',
        ]);

        $file = $request->file('photo');
        $photo = \App\Services\CloudinaryService::upload($file, 'client-profile')
            ?? url('/storage/'.$file->store('client-profile', 'public'));

        $request->user()->update(['photo' => $photo]);

        return response()->json(['photo' => $photo]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Sesión cerrada']);
    }
}
