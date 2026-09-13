# Financy

Aplicación de finanzas personales con **NestJS + React + TypeScript + PostgreSQL**, preparada para Vercel. La implementación nueva está en `apps/`; `laravel_legacy/` conserva la aplicación original sin cambios.

## Revisar la app ahora

Requiere Node.js 22 o superior.

```sh
npm ci
npm run dev:demo
```

Abre **http://localhost:5173**. Usuario: `demo@financy.local`, contraseña: `FinancyDemo2026!`.

Esta demo crea PostgreSQL embebido con PGlite **en memoria**, exclusivamente local. No lee las credenciales de Laravel ni conecta a producción. Los datos se reinician al detenerla. El entrypoint de producción no incluye la demo.

## Desarrollo con PostgreSQL

```sh
# PowerShell
Copy-Item apps/api/.env.example apps/api/.env
```

Configura `DATABASE_URL` en ese archivo y ejecuta:

```sh
npm run db:migrate
npm run dev
```

Usa `http://localhost:5173` para mantener el origen configurado en `APP_URL`. La API escucha en el puerto 3000; Vite reenvía `/api` a NestJS.

## Qué incluye

- Registro, login, sesiones HttpOnly persistentes en PostgreSQL, logout, verificación de correo, recuperación y cambio de contraseña, confirmación de contraseña y eliminación de cuenta.
- Ingresos y gastos únicos o recurrentes, edición, eliminación, cobro/pago manual anticipado y automático al vencer, historial, etiquetas y búsqueda.
- Caja y ahorros, cargos distribuidos entre cuentas, transferencias y reversión exacta de los movimientos creados por la nueva API.
- Compras pendientes, compra con o sin descuento de saldo, regalos, edición y vuelta a pendiente con devolución del importe.
- Presupuestos mensuales por palabras clave, límite mensual con avisos visuales, dashboard y gráficos basados en datos reales.
- Reportes filtrados por fechas, cuenta, texto y proyecto; CSV protegido contra fórmulas e impresión/PDF del reporte completo.
- Reparto de gastos por importes o partes iguales, control de pagos por participante.
- Conversor USD/Bs/EUR con las fórmulas heredadas, tasas históricas con búsqueda de hasta 7 días previos y fallback oficial DolarVzla opcional.
- UI en español, adaptable a móvil, formularios con validación, diálogos con foco y Escape, estados vacíos y recuperación de errores.

## Estructura

```text
apps/api/src/         Controladores, servicios, autenticación y trabajos NestJS
apps/api/database/    SQL compatible con el esquema PostgreSQL final de Laravel
apps/api/test/        Pruebas SQL, financieras y HTTP con PGlite
apps/web/src/         Interfaz React, formularios y estilos
tests/e2e/           Flujos completos con Playwright
docs/                Migración, despliegue y contrato de API
artifacts/           Capturas de escritorio y móvil
laravel_legacy/      Referencia original, sin modificaciones
```

Los importes se calculan con `decimal.js`; PostgreSQL conserva valores decimales y la API devuelve importes como cadenas. Las escrituras financieras bloquean la fila del usuario dentro de una transacción, serializando operaciones sobre sus cuentas. Todas las consultas financieras filtran por usuario, también cuando hay proyecto.

## Desplegar y migrar

Sigue [la guía de Vercel](docs/DEPLOYMENT.md) y [el procedimiento de migración](docs/MIGRATION.md). Se crean dos proyectos Vercel: API NestJS y frontend Vite, con `/api` reenviado desde el frontend para mantener las cookies en el mismo origen.

La aplicación necesita PostgreSQL y Resend configurados para operar con usuarios reales. Las migraciones se ejecutan explícitamente, nunca durante un cold start. No se ha desplegado ni modificado ninguna base remota.

## Validación

```sh
npm run build
npm test
npx playwright install chromium
npx playwright test
npm audit
```

Las pruebas de backend ejecutan SQL real en PostgreSQL embebido; no sustituyen una prueba de concurrencia con múltiples conexiones contra el PostgreSQL de destino. Playwright verifica el flujo de ingresos, gastos, transferencias, presupuestos, compras, exportación, perfil y navegación móvil. El workflow de CI ejecuta compilación y ambas suites.

El pin de `multer` a 2.3.0 y la referencia al adaptador Nest en la raíz garantizan que npm aplique el override también al árbol de workspaces. No hay endpoints de subida de archivos.
