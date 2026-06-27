# @idealo/financy-ui

Source package for the FINANCY FinOps screens.

The first exported modules are:

- `EarningsModule`
- `ExpensesModule`

They currently expect the host app to provide the same `@/` alias, shared components, Tailwind setup, Inertia route helper, and authenticated layout used by FINANCY. This keeps the extraction low-risk while IdeaMap's dashboard shell is finalized.
