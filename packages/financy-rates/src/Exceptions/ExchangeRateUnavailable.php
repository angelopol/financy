<?php

namespace Idealo\FinancyRates\Exceptions;

use RuntimeException;

class ExchangeRateUnavailable extends RuntimeException
{
    public static function forCurrency(string $currency, string $date): self
    {
        return new self("No exchange rate is available for {$currency} on {$date}.");
    }
}
