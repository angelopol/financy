<?php

return [
    'dolarapi_url' => env('DOLARAPI_URL', 'https://ve.dolarapi.com'),
    'dolarvzla_url' => env('DOLARVZLA_URL', 'https://www.dolarvzla.com'),
    'dolarvzla_api_key' => env('DOLARVZLA_API_KEY'),
    'timeout' => (int) env('EXCHANGE_RATE_TIMEOUT', 12),
    'retry_times' => (int) env('EXCHANGE_RATE_RETRY_TIMES', 1),
    'retry_delay_ms' => (int) env('EXCHANGE_RATE_RETRY_DELAY_MS', 200),
    'historical_lookback_days' => (int) env('EXCHANGE_RATE_LOOKBACK_DAYS', 7),
];
