# idealo/financy-core

Backend package target for FINANCY extraction.

Current app-level implementation now supports:

- `project_id` on `expenses`, `earnings`, and `movements`.
- `expense_splits` for shared project expenses.
- Equal and fixed split validation through `App\Services\SplitExpense`.

This package keeps the Composer identity and service-provider entrypoint ready so the app code can be moved namespace-by-namespace into `Idealo\\FinancyCore` without changing the external install target.
