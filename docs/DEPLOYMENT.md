# Desplegar en Vercel

Se usan dos proyectos del mismo repositorio. La API se expone como una función serverless de Node.js mediante `apps/api/api/[[...path]].ts` (que inicializa Nest una sola vez por instancia y reenvía cada request a su adaptador Express); el frontend se sirve como archivos estáticos.

El preset "Framework: NestJS" de Vercel no se usa: en pruebas devolvía `Invalid export found in module ".../src/app.js"` porque esperaba un archivo de entrada distinto al que produce esta build. `apps/api/vercel.json` fija `"framework": null` para evitar que Vercel lo detecte automáticamente por la presencia de `@nestjs/core`; en el dashboard del proyecto, el Framework Preset debe quedar en **Other**.

## 1. Preparar PostgreSQL

Usa PostgreSQL externo, por ejemplo el proyecto Supabase existente, primero sobre una copia de pruebas. Sigue `MIGRATION.md` antes de apuntar a datos reales.

En Supabase, toma la conexión de **Connect → Pooler** que corresponda a tu entorno. Usa TLS y una contraseña codificada para URL. El pool de Node admite como máximo 3 conexiones por instancia, con timeout e inactividad acotados. No se usa SQLite ni disco local en producción.

## 2. Proyecto de API

- Root Directory: `apps/api`.
- Framework Preset: Other.
- Activa acceso a los archivos fuera del Root Directory para resolver el workspace y el lockfile de la raíz.
- Usa Node 22 o 24.
- No hace falta configurar Build Command ni Output Directory: Vercel construye `api/[[...path]].ts` como función automáticamente a partir de la convención de archivos.

Variables, exclusivamente del lado servidor:

| Variable                     | Valor                                               |
| ---------------------------- | --------------------------------------------------- |
| `DATABASE_URL`               | URL PostgreSQL con TLS y credenciales               |
| `APP_URL`                    | Origen público exacto del frontend, sin barra final |
| `NODE_ENV`                   | `production`                                        |
| `CRON_SECRET`                | Cadena aleatoria de al menos 32 caracteres          |
| `RESEND_API_KEY`             | Clave de la API de Resend                           |
| `MAIL_FROM`                  | Remitente autorizado en Resend (dominio verificado, o `onboarding@resend.dev` para pruebas) |
| `DOLARVZLA_API_KEY`          | Opcional: fallback de tasas oficiales               |
| `GEMINI_API_KEY`             | Clave de la API de Gemini para el chat de Financy IA (gemini-3.5-flash-lite) |

Para producción, verifica un dominio propio en Resend y usa un remitente de ese dominio; `onboarding@resend.dev` solo entrega a la cuenta dueña de la API key. No copies las variables al frontend ni uses el prefijo `VITE_` para secretos.

## 3. Proyecto de frontend

- Root Directory: `apps/web`.
- Framework Preset: Vite.
- Build: `npm run build`.
- Output Directory: `dist`.
- Habilita archivos fuera del Root Directory para los workspaces.
- Sustituye `https://YOUR-API.vercel.app` en `apps/web/vercel.json` por el dominio real de la API.
- Configura ese dominio del frontend como `APP_URL` en la API.

El navegador llama exclusivamente a `/api` en su propio origen. La regla proxy mantiene la cookie HttpOnly como cookie del frontend, sin habilitar CORS abierto. Las escrituras exigen `Origin === APP_URL` y JSON. Para previews, crea un par frontend/API con `APP_URL` y rewrite propios; no conectes una preview a la base de producción. Si habilitas Deployment Protection en la API, el proxy y el cron necesitan acceso compatible con esa protección.

## 4. Aplicar esquema

Desde una estación confiable, con `apps/api/.env` apuntando a la base de destino:

```sh
npm run db:migrate
```

El comando es transaccional y falla si reconoce una instalación Laravel incompleta. No se ejecuta durante el build ni al recibir solicitudes.

## 5. Cron y correo

`apps/api/vercel.json` programa `/api/cron` diariamente a las **11:00 UTC (07:00 Caracas)**. Vercel debe enviar `Authorization: Bearer <CRON_SECRET>`. El endpoint rechaza llamadas sin el secreto.

La tarea registra recurrencias automáticas vencidas, encola recordatorios del día siguiente para correos verificados y procesa hasta 20 correos pendientes. Los tokens de recuperación y verificación intentan enviarse también durante su solicitud, para no esperar al cron. Si Resend falla, quedan pendientes. Configura un programador externo con reintentos frecuentes si necesitas entrega rápida ante fallos de Resend o un volumen mayor; conserva el encabezado de autorización. Los enlaces caducan en una hora y se puede solicitar uno nuevo.

La implementación con Resend ofrece entrega al menos una vez: un fallo después de enviar y antes de confirmar SQL puede repetir un correo. Los movimientos financieros tienen transacción y clave de período para evitar dobles registros. El cron procesa un lote acotado de recurrencias; para grandes volúmenes utiliza un scheduler/worker dedicado y monitoriza los contadores `claimed` y `failed`.

## 6. Comprobar el despliegue

1. `GET /api/health` debe devolver `{"status":"ok"}` desde el dominio del frontend.
2. Registrar usuario de prueba, cerrar sesión y volver a entrar.
3. Crear ingreso, gasto y transferencia; verificar saldos.
4. Probar compra y reversión a pendiente.
5. Verificar recuperación de contraseña y recepción de correo.
6. Ejecutar el cron con autorización y comprobar que repetirlo no duplica importes.
7. Abrir una ruta interna directamente y comprobar la navegación móvil.

La compilación y los flujos locales están cubiertos por pruebas. El despliegue real, TLS del proveedor PostgreSQL y la entrega de correo requieren comprobarse con las credenciales del entorno elegido.
