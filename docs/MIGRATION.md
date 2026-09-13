# Migración desde Laravel

## Estrategia

Se conserva `laravel_legacy/` y se implementa la nueva aplicación en la raíz del workspace. El repositorio Git original sigue dentro de `laravel_legacy`; la nueva raíz debe versionarse como repositorio propio cuando se publique. El `.gitignore` de la raíz excluye el legado para no incluir sus `.env`, dumps ni dependencias.

La nueva API consume PostgreSQL con los nombres de tablas y columnas finales de Laravel: `users`, `earnings`, `expenses`, `boxes`, `savings`, `shop_list_items`, `movements`, `monthly_budgets`, `budget_categories`, `expense_splits`. Conserva `user`, `NextClaim`, `UpdatedTerm`, `OneTimeTase`, `recurring_id` y `project_id`. No se ejecutan seeds sobre bases externas.

## Procedimiento con datos existentes

1. Obtén un respaldo completo y restaura una **copia de pruebas** de PostgreSQL. Conserva el original.
2. Si el origen aún es MySQL, utiliza los scripts existentes en `laravel_legacy/scripts/` para trasladarlo a PostgreSQL. La API nueva usa exclusivamente PostgreSQL.
3. Ejecuta todas las migraciones Laravel hasta `2026_07_21_000002_create_monthly_budgets` sobre esa copia. Esto asegura el contrato de columnas que la nueva API necesita.
4. Configura `DATABASE_URL` de NestJS para la copia y ejecuta `npm run db:migrate`. El comando reconoce las columnas requeridas y crea las tablas adicionales `financy_*` sin borrar datos existentes. Para una base vacía crea el esquema completo.
5. Inicia sesión con un usuario migrado y compara saldos, historial, presupuestos, compras y recurrencias contra Laravel. Compara también cantidades de filas y totales por usuario/cuenta; hay consultas de ejemplo abajo.
6. Para el cambio definitivo, pausa escrituras y cron de Laravel, realiza un último respaldo, aplica el esquema en el destino y cambia el frontend. **No mantengas ambos cron activos.**
7. Conserva Laravel y el respaldo. Para revertir, pausa primero NestJS y reconcilia los movimientos posteriores al cambio; una restauración del respaldo por sí sola perdería esos movimientos.

No se ha abierto ni usado la configuración privada de Laravel, ejecutado un import de producción ni modificado su repositorio.

## Compatibilidad de identidad y fechas

- Los hashes bcrypt `$2y$` se verifican con bcryptjs después de normalizar su prefijo a `$2b$`. Los usuarios no necesitan cambiar contraseñas bcrypt. Hashes de otros algoritmos requieren recuperación de contraseña.
- Las sesiones Laravel y sus enlaces de recuperación/verificación no se reutilizan. El usuario inicia sesión nuevamente; IDs, correo y estado de verificación se preservan.
- Las columnas `timestamp without time zone` se interpretan como hora local de Caracas, el valor por defecto de `APP_TIMEZONE` en el legado. Si tu instalación usó otra zona, adapta la configuración y prueba las fechas antes de migrar.
- Las nuevas tablas de sesiones y tokens usan expiraciones `timestamptz`.

## Correcciones y decisiones de comportamiento

- Los proyectos se filtran **también por usuario**. El legado permitía consultar por `project_id` sin ese filtro. No hay membresías de proyectos en el esquema original; no se inventa acceso compartido. Los repartos son registros del propietario del gasto y no otorgan acceso a otro usuario.
- Crear, editar, borrar, comprar, revertir y transferir se ejecuta dentro de transacciones con bloqueo por usuario.
- Un gasto sin fondos suficientes se rechaza; ya no se registra como pagado mientras los saldos se recortan a cero.
- Editar un importe revierte la imputación anterior y aplica la nueva. No permite cambiar único↔recurrente en una edición; crea un registro nuevo para esa transición.
- Cada nueva imputación guarda cuánto se tomó de caja y de ahorros. **Laravel no guardaba ese reparto**: al revertir movimientos antiguos se usa el `provider` histórico. No es posible reconstruir exactamente una distribución que el origen nunca registró; revisa esos casos antes de corregir históricos.
- No se permite editar directamente gastos asociados a compras: se devuelve la compra a pendiente para corregirla. Las compras no se pueden registrar dos veces.
- Las plantillas recurrentes ya no se agregan como movimientos realizados; los reportes cuentan únicamente hechos reales, igual que las consultas históricas del legado.
- El cobro manual puede anticiparse y envía el ancla visible para detectar ediciones/cobros concurrentes. El automático solo actúa al vencer. El siguiente período se calcula desde el momento del cobro, como en Laravel; no se generan automáticamente todos los períodos atrasados.
- Se mantienen los ciclos mensuales de día 31 ajustados al fin del mes. Las nuevas recurrencias se crean con automatización desactivada salvo elección explícita del usuario.
- Las monedas heredadas conservan sus fórmulas: `bs` y `$parallel` dividen por paralelo; `$bcv` multiplica por BCV/paralelo; `€` usa euro/paralelo. Las nuevas variantes EUR oficial y Bs BCV se convierten a USD al guardarse para respetar el enum histórico.
- Los saldos existentes se preservan; no se recalculan automáticamente a partir de historiales potencialmente inconsistentes.

## Comprobaciones SQL de lectura

```sql
SELECT 'users' AS tabla, count(*) FROM users
UNION ALL SELECT 'earnings', count(*) FROM earnings
UNION ALL SELECT 'expenses', count(*) FROM expenses
UNION ALL SELECT 'shop_list_items', count(*) FROM shop_list_items;

SELECT "user", count(*) FROM boxes GROUP BY "user" HAVING count(*) <> 1;
SELECT "user", count(*) FROM savings GROUP BY "user" HAVING count(*) <> 1;

SELECT "user", amount FROM boxes ORDER BY "user";
SELECT "user", amount FROM savings ORDER BY "user";

SELECT "user", provider, sum(amount)
FROM expenses
WHERE term IS NULL AND claim_day IS NULL AND project_id IS NULL
GROUP BY "user", provider ORDER BY "user", provider;

SELECT lower(email), count(*) FROM users GROUP BY lower(email) HAVING count(*) > 1;
```

Si existen varias cajas o cuentas de ahorro por usuario, la API detiene las operaciones para evitar actualizar varias filas. Resuelve esa inconsistencia sobre la copia de migración con el respaldo como referencia. Comprueba también cuentas sin filas, saldos negativos y el rango decimal del esquema de destino.
