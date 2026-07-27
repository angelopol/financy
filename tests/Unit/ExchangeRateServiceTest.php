<?php

namespace Tests\Unit;

use Carbon\Carbon;
use Idealo\FinancyRates\Services\ExchangeRateService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ExchangeRateServiceTest extends TestCase
{
    public function test_it_uses_historical_rates_for_the_operation_date(): void
    {
        Carbon::setTestNow('2026-07-27 12:00:00');
        Http::fake([
            'https://ve.dolarapi.com/v1/historicos/dolares/2026/07/20' => Http::response([
                ['fuente' => 'BCV', 'promedio' => 36],
                ['fuente' => 'Yadio', 'promedio' => 40],
            ]),
            'https://ve.dolarapi.com/v1/historicos/euros/2026/07/20' => Http::response([
                ['fuente' => 'BCV', 'promedio' => 44],
                ['fuente' => 'Yadio', 'promedio' => 48],
            ]),
        ]);

        $service = app(ExchangeRateService::class);

        $this->assertSame(10.0, $service->toDollars('VES_BCV', 360, '2026-07-20'));
        $this->assertSame(12.0, $service->toDollars('EUR_PARALLEL', 10, '2026-07-20'));
        Http::assertSentCount(4);

        Carbon::setTestNow();
    }

    public function test_it_queries_live_rates_for_each_conversion_operation(): void
    {
        Http::fake([
            'https://ve.dolarapi.com/v1/dolares' => Http::response([
                ['nombre' => 'Oficial', 'promedio' => 36],
                ['nombre' => 'Paralelo', 'promedio' => 40],
            ]),
            'https://ve.dolarapi.com/v1/euros' => Http::response([
                ['nombre' => 'Oficial', 'promedio' => 44],
                ['nombre' => 'Paralelo', 'promedio' => 48],
            ]),
        ]);

        $service = app(ExchangeRateService::class);
        $service->toDollars('VES_PARALLEL', 400);
        $service->toDollars('VES_PARALLEL', 400);

        Http::assertSentCount(4);
    }
}
