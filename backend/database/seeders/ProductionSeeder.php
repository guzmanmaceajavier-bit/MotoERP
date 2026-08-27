<?php

namespace Database\Seeders;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ProductionSeeder extends Seeder
{
    public function run(): void
    {
        $password = env('SEED_PASSWORD', Str::random(16));

        $admin = User::where('email', 'admin@motohub.test')->first();
        if ($admin) {
            $admin->update([
                'role' => 'admin',
                'name' => 'Carlos Mendoza',
                'password' => Hash::make($password),
            ]);
        } else {
            User::create([
                'email' => 'admin@motohub.test',
                'name' => 'Carlos Mendoza',
                'phone' => '3000000000',
                'role' => 'admin',
                'password' => Hash::make($password),
            ]);
        }

        $this->command?->info("Admin listo: admin@motohub.test / {$password}");

        Setting::firstOrCreate(
            ['key' => 'workshop_name'],
            ['value' => 'MotoHouse']
        );
        Setting::firstOrCreate(
            ['key' => 'workshop_phone'],
            ['value' => '573016838490']
        );
        Setting::firstOrCreate(
            ['key' => 'workshop_logo'],
            ['value' => '']
        );
    }
}
