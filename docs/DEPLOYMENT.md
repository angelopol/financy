# Desplegar en Vercel

Se usa **un solo proyecto de Vercel** para todo el repositorio. `vercel.json` en la raíz construye el frontend (Vite) como archivos estáticos y expone la API como una función serverless de Node.js en `api/[[...path]].ts`, que inicializa Nest una sola vez por instancia y reenvía cada request a su adaptador Express. Ambos quedan en el mismo dominio, así que no hace falta proxy entre proyectos ni sincronizar dos `APP_URL`.

El preset "Framework: NestJS" de Vercel no se usa para la API: en pruebas devolvía `Invalid export found in module ".../src/app.js"` porque esperaba un archivo de entrada distinto al que produce esta build. `vercel.json` fija `"framework": null` para evitar que Vercel detecte NestJS automáticamente por la presencia de `@nestjs/core`; en el dashboard del proyecto, el Framework Preset debe quedar en **Other**.

## 1. Preparar PostgreSQL

Usa PostgreSQL externo, por ejemplo el proyecto Supabase existente, primero sobre una copia de pruebas. Sigue `MIGRATION.md` antes de apuntar a datos reales.

En Supabase, toma la conexión de **Connect → Pooler** que corresponda a tu entorno. Usa TLS y una contraseña codificada para URL. El pool de Node admite como máximo 3 conexiones por instancia, con timeout e inactividad acotados. No se usa SQLite ni disco local en producción.

## 2. Proyecto de Vercel

- Root Directory: la raíz del repositorio (no `apps/web` ni `apps/api`).
- Framework Preset: Other.
- Usa Node 22 o 24.
- Build Command y Output Directory ya quedan fijados en `vercel.json`; no hace falta configurarlos en el dashboard. El Build Command primero aplica el esquema (`npm run db:migrate -w apps/api`) y luego construye el frontend (`npm run build -w apps/web`).
- Vercel construye `api/[[...path]].ts` como función automáticamente a partir de la convención de archivos, sin build propio: internamente importa y compila `apps/api/src/app.ts`, por lo que `tsconfig.json` en la raíz debe mantener `experimentalDecorators`/`emitDecoratorMetadata` para que los decoradores de Nest compilen ahí.

Variables de entorno, exclusivamente del lado servidor (nunca con prefijo `VITE_`, que sí llega al bundle del navegador):

| Variable                     | Valor                                               |
| ---------------------------- | --------------------------------------------------- |
| `DATABASE_URL`               | URL PostgreSQL con TLS y credenciales               |
| `APP_URL`                    | Dominio público exacto de este proyecto, sin barra final |
| `NODE_ENV`                   | `production`                                        |
| `CRON_SECRET`                | Cadena aleatoria de al menos 32 caracteres          |
| `RESEND_API_KEY`             | Clave de la API de Resend                           |
| `MAIL_FROM`                  | Remitente autorizado en Resend (dominio verificado, o `onboarding@resend.dev` para pruebas) |
| `DOLARVZLA_API_KEY`          | Opcional: fallback de tasas oficiales               |
| `GEMINI_API_KEY`             | Clave de la API de Gemini para el chat de Financy IA (gemini-3.5-flash-lite) |

Para producción, verifica un dominio propio en Resend y usa un remitente de ese dominio; `onboarding@resend.dev` solo entrega a la cuenta dueña de la API key.

El navegador llama a `/api` en el mismo origen que sirve el frontend (mismo dominio, misma función). La cookie de sesión queda HttpOnly de primera parte, sin CORS abierto. Las escrituras exigen `Origin === APP_URL` y JSON. Para previews, cada deployment de Vercel tiene su propia URL; si necesitas que las escrituras funcionen en un preview, define `APP_URL` para ese entorno o prueba solo lecturas. No conectes un preview a la base de producción. Si habilitas Deployment Protection, el cron necesita acceso compatible con esa protección.

## 3. Esquema automático en cada deploy

El Build Command de Vercel ejecuta `npm run db:migrate -w apps/api` antes de construir el frontend, así que el esquema se aplica solo en cada deploy (producción y previews) contra el `DATABASE_URL` configurado para ese entorno. El comando es transaccional, idempotente (usa `CREATE TABLE IF NOT EXISTS`/`CREATE INDEX IF NOT EXISTS`, nunca `DROP`/`ALTER`/`DELETE`) y falla el build entero si reconoce una instalación Laravel incompleta o no puede conectar — sin aplicar cambios parciales. Volver a desplegar sin migraciones pendientes es un no-op seguro.

Para aplicarlo manualmente contra otra base (por ejemplo antes del primer deploy, o desde una estación de confianza), con `apps/api/.env` apuntando al destino:

```sh
npm run db:migrate
```

## 4. Cron y correo

`vercel.json` programa `/api/cron` diariamente a las **11:00 UTC (07:00 Caracas)**. Vercel debe enviar `Authorization: Bearer <CRON_SECRET>`. El endpoint rechaza llamadas sin el secreto.

La tarea registra recurrencias automáticas vencidas, encola recordatorios del día siguiente para correos verificados y procesa hasta 20 correos pendientes. Los tokens de recuperación y verificación intentan enviarse también durante su solicitud, para no esperar al cron. Si Resend falla, quedan pendientes. Configura un programador externo con reintentos frecuentes si necesitas entrega rápida ante fallos de Resend o un volumen mayor; conserva el encabezado de autorización. Los enlaces caducan en una hora y se puede solicitar uno nuevo.

La implementación con Resend ofrece entrega al menos una vez: un fallo después de enviar y antes de confirmar SQL puede repetir un correo. Los movimientos financieros tienen transacción y clave de período para evitar dobles registros. El cron procesa un lote acotado de recurrencias; para grandes volúmenes utiliza un scheduler/worker dedicado y monitoriza los contadores `claimed` y `failed`.

## 5. Comprobar el despliegue

1. `GET /api/health` debe devolver `{"status":"ok"}` desde el dominio del proyecto.
2. Registrar usuario de prueba, cerrar sesión y volver a entrar.
3. Crear ingreso, gasto y transferencia; verificar saldos.
4. Probar compra y reversión a pendiente.
5. Verificar recuperación de contraseña y recepción de correo.
6. Ejecutar el cron con autorización y comprobar que repetirlo no duplica importes.
7. Abrir una ruta interna directamente (por ejemplo `/dashboard`) y recargar, para comprobar que el rewrite de SPA sirve `index.html` en vez de un 404.
8. Comprobar la navegación móvil.

La compilación y los flujos locales están cubiertos por pruebas. El despliegue real, TLS del proveedor PostgreSQL y la entrega de correo requieren comprobarse con las credenciales del entorno elegido.
