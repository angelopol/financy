# idealo/financy-rates

Reusable exchange-rate package extracted from FINANCY.

- Queries current official and parallel USD/EUR rates from DolarAPI.
- Queries historical rates using the operation date.
- Looks back up to seven days for weekends and holidays.
- Uses DolarVzla as an optional fallback for official BCV rates.
- Does not create tables, persist rates, or cache responses.

Consumers use `Idealo\FinancyRates\Services\ExchangeRateService`.
