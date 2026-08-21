<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('maintenance:check')->dailyAt('09:00');
Schedule::command('warranties:check')->dailyAt('09:30');
Schedule::command('inventory:low-check')->dailyAt('08:00');
Schedule::command('appointments:remind')->hourly();
Schedule::command('backup:database')->dailyAt('23:30');
