<?php

namespace Idealo\FinancyRates\Services;

use Carbon\CarbonImmutable;
use DateTimeInterface;
use Idealo\FinancyRates\Exceptions\ExchangeRateUnavailable;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Throwable;

class ExchangeRateService
{
    public function get(DateTimeInterface|string|null $date = null): array
    {
        $rates = $this->ratesFor($date);

        foreach (['bcv', 'parallel', 'euro', 'euro_parallel'] as $key) {
            $this->requiredRate($rates, $key, $rates['requested_date']);
        }

        return $rates;
    }

    public function ratesFor(DateTimeInterface|string|null $date = null): array
    {
        $requestedDate = $this->normalizeDate($date);
        $dollars = $this->fetchDolarApiPair('dolares', $requestedDate);
        $euros = $this->fetchDolarApiPair('euros', $requestedDate);
        $dolarVzla = null;

        if (! isset($dollars['official']) || ! isset($euros['official'])) {
            $dolarVzla = $this->fetchDolarVzlaOfficialRates($requestedDate);
        }

        return [
            'parallel' => $dollars['parallel'] ?? null,
            'bcv' => $dollars['official'] ?? $dolarVzla['usd'] ?? null,
            'euro' => $euros['official'] ?? $dolarVzla['eur'] ?? null,
            'euro_parallel' => $euros['parallel'] ?? null,
            'requested_date' => $requestedDate,
            'effective_date' => $dollars['date'] ?? $euros['date'] ?? $dolarVzla['date'] ?? $requestedDate,
            'source' => $this->sourceLabel($dollars, $euros, $dolarVzla),
        ];
    }

    public function factorToDollars(string $currency, DateTimeInterface|string|null $date = null): float
    {
        $currency = $this->normalizeCurrency($currency);

        if ($currency === 'USD') {
            return 1.0;
        }

        return $this->factorFromRates($currency, $this->ratesFor($date));
    }

    public function toDollars(
        string $currency,
        float $amount,
        DateTimeInterface|string|array|null $date = null,
        ?array $rates = null
    ): float {
        if (is_array($date)) {
            $rates = $date;
            $date = null;
        }

        $factor = $rates === null
            ? $this->factorToDollars($currency, $date)
            : $this->factorFromRates($currency, $rates);

        return round($amount * $factor, 2);
    }

    private function factorFromRates(string $currency, array $rates): float
    {
        $currency = $this->normalizeCurrency($currency);
        $date = (string) ($rates['requested_date'] ?? now()->toDateString());

        return match ($currency) {
            'USD' => 1.0,
            'VES_BCV' => 1 / $this->requiredRate($rates, 'bcv', $date),
            'VES', 'VES_PARALLEL' => 1 / $this->requiredRate($rates, 'parallel', $date),
            'EUR', 'EUR_BCV' => $this->requiredRate($rates, 'euro', $date)
                / $this->requiredRate($rates, 'bcv', $date),
            'EUR_PARALLEL' => $this->requiredRate($rates, 'euro_parallel', $date)
                / $this->requiredRate($rates, 'parallel', $date),
            'USD_BCV' => $this->requiredRate($rates, 'bcv', $date)
                / $this->requiredRate($rates, 'parallel', $date),
            'EUR_LEGACY' => $this->requiredRate($rates, 'euro', $date)
                / $this->requiredRate($rates, 'parallel', $date),
            default => throw ExchangeRateUnavailable::forCurrency($currency, $date),
        };
    }

    private function fetchDolarApiPair(string $asset, string $requestedDate): array
    {
        $today = CarbonImmutable::today()->toDateString();
        $isPast = $requestedDate < $today;
        $attempts = $isPast ? max((int) config('financy-rates.historical_lookback_days', 7), 0) : 0;

        for ($daysBack = 0; $daysBack <= $attempts; $daysBack++) {
            $effectiveDate = CarbonImmutable::parse($requestedDate)->subDays($daysBack);
            $path = $isPast
                ? "/v1/historicos/{$asset}/{$effectiveDate->format('Y/m/d')}"
                : "/v1/{$asset}";
            $rows = $this->request(
                config('financy-rates.dolarapi_url', 'https://ve.dolarapi.com'),
                $path
            );

            if ($rows === null) {
                continue;
            }

            $rows = array_is_list($rows) ? $rows : [$rows];
            $pair = $this->parsePair($rows);

            if ($pair !== []) {
                return [
                    ...$pair,
                    'date' => $effectiveDate->toDateString(),
                    'source' => 'dolarapi',
                ];
            }
        }

        return [];
    }

    private function fetchDolarVzlaOfficialRates(string $requestedDate): ?array
    {
        $apiKey = (string) config('financy-rates.dolarvzla_api_key', '');

        if ($apiKey === '') {
            return null;
        }

        $today = CarbonImmutable::today()->toDateString();
        $isPast = $requestedDate < $today;
        $path = $isPast ? '/public/bcv/exchange-rate/list' : '/public/bcv/exchange-rate';
        $query = $isPast ? ['from' => $requestedDate, 'to' => $requestedDate] : [];
        $json = $this->request(
            config('financy-rates.dolarvzla_url', 'https://www.dolarvzla.com'),
            $path,
            $query,
            ['x-dolarvzla-key' => $apiKey]
        );

        if ($json === null) {
            return null;
        }

        $row = $isPast ? (($json['rates'] ?? [])[0] ?? null) : ($json['current'] ?? null);

        if (! is_array($row)) {
            return null;
        }

        return [
            'usd' => $this->positiveFloat($row['usd'] ?? null),
            'eur' => $this->positiveFloat($row['eur'] ?? null),
            'date' => $isPast ? $requestedDate : $today,
            'source' => 'dolarvzla',
        ];
    }

    private function request(
        ?string $baseUrl,
        string $path,
        array $query = [],
        array $headers = []
    ): ?array {
        try {
            $response = $this->client($baseUrl, $headers)->get($path, $query);

            if (! $response->successful()) {
                return null;
            }

            $json = $response->json();

            return is_array($json) ? $json : null;
        } catch (Throwable) {
            return null;
        }
    }

    private function client(?string $baseUrl, array $headers): PendingRequest
    {
        return Http::baseUrl(rtrim((string) $baseUrl, '/'))
            ->acceptJson()
            ->withHeaders($headers)
            ->retry(
                max((int) config('financy-rates.retry_times', 1), 0),
                max((int) config('financy-rates.retry_delay_ms', 200), 0)
            )
            ->timeout(max((int) config('financy-rates.timeout', 12), 1));
    }

    private function parsePair(array $rows): array
    {
        $pair = [];

        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }

            $label = mb_strtolower(implode(' ', array_filter([
                $row['fuente'] ?? null,
                $row['nombre'] ?? null,
            ])));
            $value = $this->positiveFloat($row['promedio'] ?? null);

            if ($value === null) {
                continue;
            }

            if (str_contains($label, 'paralelo') || str_contains($label, 'yadio')) {
                $pair['parallel'] = $value;
            } elseif (str_contains($label, 'oficial') || str_contains($label, 'bcv')) {
                $pair['official'] = $value;
            }
        }

        return $pair;
    }

    private function requiredRate(array $rates, string $key, string $date): float
    {
        $rate = $this->positiveFloat($rates[$key] ?? null);

        if ($rate === null) {
            throw ExchangeRateUnavailable::forCurrency($key, $date);
        }

        return $rate;
    }

    private function positiveFloat(mixed $value): ?float
    {
        if (! is_numeric($value) || (float) $value <= 0) {
            return null;
        }

        return (float) $value;
    }

    private function normalizeDate(DateTimeInterface|string|null $date): string
    {
        try {
            return CarbonImmutable::parse($date ?? now())->toDateString();
        } catch (Throwable) {
            return CarbonImmutable::today()->toDateString();
        }
    }

    private function normalizeCurrency(string $currency): string
    {
        return match (mb_strtolower(trim($currency))) {
            '$' => 'USD',
            'bs' => 'VES',
            '$bcv' => 'USD_BCV',
            '$parallel' => 'VES_PARALLEL',
            '€', 'â‚¬' => 'EUR_LEGACY',
            default => strtoupper(trim($currency)),
        };
    }

    private function sourceLabel(array $dollars, array $euros, ?array $dolarVzla): string
    {
        return implode('+', array_values(array_unique(array_filter([
            $dollars['source'] ?? null,
            $euros['source'] ?? null,
            $dolarVzla['source'] ?? null,
        ]))));
    }
}
