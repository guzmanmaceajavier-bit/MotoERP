<?php

namespace Database\Seeders;

use App\Models\Settings;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ProductionSeeder extends Seeder
{
    public function run(): void
    {
        $password = env('SEED_PASSWORD', 'secret123');

        User::firstOrCreate(
            ['email' => 'admin@motohub.test'],
            [
                'name' => 'Administrador',
                'phone' => '3000000000',
                'role' => 'super_admin',
                'password' => Hash::make($password),
            ]
        );

        $this->command?->info("Admin creado: admin@motohub.test / {$password}");

        Settings::firstOrCreate(
            ['key' => 'workshop_name'],
            ['value' => 'MotoHouse']
        );
        Settings::firstOrCreate(
            ['key' => 'workshop_phone'],
            ['value' => '573016838490']
        );
        Settings::firstOrCreate(
            ['key' => 'workshop_logo'],
            ['value' => '']
        );
    }
}
