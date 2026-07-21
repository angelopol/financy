<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

class ExchangeRateService
{
    public function get(): array
    {
        return Cache::remember('financy.exchange-rates', now()->addMinutes(15), function () {
            try {
                $dollars = Http::timeout(8)->get('https://ve.dolarapi.com/v1/dolares')->throw()->json();
                $euros = Http::timeout(8)->get('https://ve.dolarapi.com/v1/euros')->throw()->json();

                return [
                    'parallel' => $this->rate($dollars, 'paralelo'),
                    'bcv' => $this->rate($dollars, 'oficial'),
                    'euro' => $this->rate($euros, 'oficial'),
                    'euro_parallel' => $this->rate($euros, 'paralelo'),
                ];
            } catch (Throwable) {
                return ['parallel' => 1, 'bcv' => 1, 'euro' => 1, 'euro_parallel' => 1];
            }
        });
    }

    public function toDollars(string $currency, float $amount, ?array $rates = null): float
    {
        $rates ??= $this->get();

        return match ($currency) {
            'bs' => $amount / max((float) $rates['parallel'], 0.000001),
            '$bcv' => ($amount * (float) $rates['bcv']) / max((float) $rates['parallel'], 0.000001),
            '$parallel' => $amount / max((float) $rates['parallel'], 0.000001),
            '€' => ($amount * (float) $rates['euro']) / max((float) $rates['parallel'], 0.000001),
            default => $amount,
        };
    }

    private function rate(array $items, string $needle): float
    {
        foreach ($items as $item) {
            $label = strtolower(($item['fuente'] ?? '').' '.($item['nombre'] ?? ''));
            if (str_contains($label, $needle)) {
                return (float) ($item['promedio'] ?? 1);
            }
        }

        return (float) ($items[0]['promedio'] ?? 1);
    }
}
