<?php

namespace App\Services;

use App\Support\Settings;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

// copias de la base de datos con pg_dump
class BackupService
{
    private function dbEnv(): array
    {
        $cfg = config('database.connections.pgsql');
        $env = $_ENV + getenv();
        $env['PGPASSWORD'] = (string) $cfg['password'];
        $env['PGCLIENTENCODING'] = 'UTF8';

        return $env;
    }

    private function dbCommand(array $args): Process
    {
        $cfg = config('database.connections.pgsql');
        $base = [
            '--host=' . $cfg['host'],
            '--port=' . (string) $cfg['port'],
            '--username=' . $cfg['username'],
        ];
        $proc = new Process([...$base, ...$args, $cfg['database']]);
        $proc->setEnv($this->dbEnv());
        $proc->setTimeout(300);

        return $proc;
    }

    // saca el dump, si falla tira error
    public function backup(): array
    {
        try {
            $proc = $this->dbCommand(['--no-owner', '--no-privileges', '--clean', '--if-exists']);
            $proc->run();
            if (! $proc->isSuccessful()) {
                Log::error('Backup fallido: ' . $proc->getErrorOutput());

                throw new \RuntimeException('No se pudo generar el backup.');
            }
        } catch (\RuntimeException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error('Backup excepción: ' . $e->getMessage());

            throw new \RuntimeException('No se pudo generar el backup.');
        }

        $sql = $proc->getOutput();
        $filename = 'motoerp-backup-' . date('Y-m-d-His') . '.sql';
        Settings::set('last_backup_at', now()->toDateTimeString());

        return [
            'filename' => $filename,
            'size' => strlen($sql),
            'payload' => base64_encode($sql),
            'hash' => hash('sha256', $sql),
            'generated_at' => now()->toDateTimeString(),
        ];
    }

    // restaura el dump que llega en base64
    public function restore(string $sqlBase64): void
    {
        $sql = base64_decode($sqlBase64, true);
        if ($sql === false || empty(trim((string) $sql))) {
            throw new \InvalidArgumentException('El backup es inválido.');
        }

        try {
            $proc = $this->dbCommand(['--single-transaction', '-v', 'ON_ERROR_STOP=1']);
            $proc->setInput($sql);
            $proc->run();
            if (! $proc->isSuccessful()) {
                Log::error('Restore fallido: ' . $proc->getErrorOutput());

                throw new \RuntimeException('No se pudo restaurar el backup.');
            }
        } catch (\RuntimeException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error('Restore excepción: ' . $e->getMessage());

            throw new \RuntimeException('No se pudo restaurar el backup.');
        }

        Settings::set('last_restore_at', now()->toDateTimeString());
    }

    // borra todo menos usuarios y configuracion
    public function reset(): void
    {
        $tables = DB::select("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
        $names = array_map(fn ($t) => $t->tablename, $tables);
        $excluded = ['migrations', 'users', 'settings'];

        $targets = array_filter($names, fn ($n) => ! in_array($n, $excluded, true));
        if (count($targets) > 0) {
            DB::statement('TRUNCATE TABLE ' . implode(', ', array_map(fn ($n) => '"' . $n . '"', $targets)) . ' RESTART IDENTITY CASCADE');
        }
    }
}
