<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackupDatabase extends Command
{
    protected $signature = 'backup:database';

    protected $description = 'Crea un respaldo de la base de datos en storage/app/backups';

    public function handle(): int
    {
        $dir = storage_path('app/backups');
        if (! is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        $filename = 'backup-' . now()->format('Y-m-d_His') . '.sql';
        $path = $dir . DIRECTORY_SEPARATOR . $filename;

        $driver = config('database.default');
        $connection = config("database.connections.{$driver}");

        $envBin = config('backup.pg_dump_path', 'pg_dump');
        $command = '';
        $exitCode = 1;

        if ($driver === 'pgsql') {
            $cmd = [
                $envBin,
                '-h', $connection['host'] ?? '127.0.0.1',
                '-p', (string) ($connection['port'] ?? 5432),
                '-U', $connection['username'] ?? 'postgres',
                '-d', $connection['database'] ?? '',
                '--no-owner',
                '--no-privileges',
            ];
            if (! empty($connection['password'])) {
                putenv('PGPASSWORD=' . $connection['password']);
            }

            $command = escapeshellcmd(implode(' ', array_map('escapeshellarg', $cmd))) . ' > ' . escapeshellarg($path);

            exec($command . ' 2>&1', $output, $exitCode);
        } elseif ($driver === 'mysql') {
            $cmd = [
                config('backup.mysqldump_path', 'mysqldump'),
                '-h', $connection['host'] ?? '127.0.0.1',
                '-P', (string) ($connection['port'] ?? 3306),
                '-u', $connection['username'] ?? 'root',
                $connection['database'] ?? '',
            ];
            if (! empty($connection['password'])) {
                $cmd[] = '-p' . $connection['password'];
            }
            $command = escapeshellcmd(implode(' ', array_map('escapeshellarg', $cmd))) . ' > ' . escapeshellarg($path);
            exec($command . ' 2>&1', $output, $exitCode);
        }

        if ($exitCode !== 0 || ! file_exists($path) || filesize($path) === 0) {
            $this->error('No se pudo generar el respaldo: ' . implode("\n", $output ?? []));

            return 1;
        }

        // Limpiar respaldos mayores a 30 días
        $kept = 0;
        foreach (glob($dir . '/backup-*.sql') ?: [] as $file) {
            if (filemtime($file) < now()->subDays(30)->getTimestamp()) {
                @unlink($file);
            } else {
                $kept++;
            }
        }

        $this->info("Respaldo creado: {$filename} ({$kept} respaldos conservados)");

        return 0;
    }
}