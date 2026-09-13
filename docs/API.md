# Contrato de API

Prefijo `/api`. Las rutas financieras requieren `financy_session` HttpOnly. Escrituras: JSON y encabezado `Origin` igual a `APP_URL`. Todas las rutas financieras están limitadas al usuario de sesión. No se envía `user` desde el cliente.

| Método         | Ruta                                                    | Función                                         |
| -------------- | ------------------------------------------------------- | ----------------------------------------------- |
| GET            | `/health`                                               | Verifica conexión y esquema                     |
| POST           | `/auth/register`, `/auth/login`, `/auth/logout`         | Sesión                                          |
| GET            | `/auth/me`                                              | Perfil público de la sesión                     |
| POST           | `/auth/forgot-password`, `/auth/reset-password`         | Recuperación                                    |
| POST           | `/auth/verify-email`, `/auth/verification-notification` | Verificación                                    |
| POST           | `/auth/confirm-password`, `/auth/password`              | Confirmar/cambiar contraseña                    |
| PATCH / DELETE | `/auth/profile`                                         | Editar/eliminar cuenta                          |
| GET            | `/dashboard?month=YYYY-MM`                              | Balances, totales, gráfico e historial          |
| GET / POST     | `/entries/earnings`, `/entries/expenses`                | Listar/crear                                    |
| PATCH / DELETE | `/entries/:kind/:id`                                    | Editar/eliminar                                 |
| POST           | `/entries/:kind/:id/claim`                              | Cobrar/pagar período                            |
| POST           | `/accounts/transfer`                                    | Transferir entre cuentas                        |
| GET / POST     | `/shopping`                                             | Lista/alta de compra                            |
| PATCH / DELETE | `/shopping/:id`                                         | Editar/eliminar compra                          |
| POST           | `/shopping/:id/purchase`, `/pending`, `/gift`           | Estado de compra                                |
| GET / POST     | `/budgets`                                              | Categorías por mes/crear                        |
| PATCH / DELETE | `/budgets/:id`                                          | Editar/eliminar categoría                       |
| GET / POST     | `/expenses/:id/splits`                                  | Consultar/reemplazar reparto                    |
| GET            | `/reports/:kind`, `/exports/:kind`                      | Reporte paginado/CSV completo                   |
| GET            | `/rates?date=YYYY-MM-DD`                                | Tasas disponibles y fechas                      |
| POST           | `/calculator`                                           | Convertir a USD                                 |
| GET            | `/cron`                                                 | Trabajo programado, requiere Bearer CRON_SECRET |
| GET / POST     | `/ai/messages`                                          | Historial del chat / enviar mensaje             |
| DELETE         | `/ai/messages`                                          | Borrar conversación y memoria                   |
| POST           | `/ai/actions/:id/confirm`, `/:id/cancel`                | Aplicar o descartar una acción propuesta por la IA |
| GET            | `/activity`                                             | Historial de acciones (propias y de la IA), paginado |
| POST           | `/activity/:id/undo`                                    | Deshacer una acción registrada                  |

`kind` admite `earnings` y `expenses`. Listas de movimientos: filtros `q`, `page`, `provider`, `from`, `to`, `project_id`, `mode=all|history|recurring`; páginas de 20 filas. Los reportes excluyen plantillas recurrentes y devuelven `totalAmount` sobre todo el filtro. Las listas de compras y categorías devuelven un array.

Alta/edición de movimiento (la edición reemplaza estos atributos; el frontend envía el formulario completo):

```json
{
  "description": "Ingreso mensual",
  "amount": "100.00",
  "currency": "$",
  "provider": "box",
  "slug": "salario trabajo",
  "recurrence_type": "monthly",
  "claim_day": 15,
  "auto_claim": false,
  "project_id": null
}
```

Para intervalo usa `recurrence_type: "days"`, `term` y opcionalmente `nextterm`; para único usa `one_time`. Proveedores: `box|savings|auto`. Importes positivos con máximo dos decimales. El cobro manual anticipado envía `{"expected_anchor":"<UpdatedTerm recibido en la lista>"}`; sin ancla solo se cobra si ya venció.

Transferencia: `{"from":"box","amount":"10.00"}`. Compra: `{"provider":"auto","amount":"20.00","not_discount":false}`. Categoría: `{"month":"2026-09","name":"Comida","amount":"100.00","slug":"mercado comida"}`. Conversión: `{"currency":"bs","amount":"400.00","date":"2026-09-01"}`.

Reparto: `{"splits":[{"user_id":"1","amount":"10.00","paid_amount":0}]}`. Debe sumar el importe del gasto; `[]` elimina el reparto. No ejecuta transferencias entre usuarios.

Chat: `POST /ai/messages` recibe `{"message":"...","request_id":"<uuid>"}` (idempotente por `request_id`) y responde `{"messages":[...],"model":"..."}`. Financy IA puede llamar herramientas de solo lectura y, para `registrar_ingreso`, `registrar_gasto`, `transferir_dinero`, `crear_presupuesto` o `agregar_compra`, solo *propone* una acción: queda en `financy_ai_actions` con estado `pending` y se adjunta como `action:{id,kind,summary,status}` al mensaje del modelo. Nada se aplica hasta que el usuario llama a `POST /ai/actions/:id/confirm` (ejecuta la acción con las mismas reglas de negocio que el formulario manual: saldo, transacciones, conversión de moneda) o `/:id/cancel`. Una acción ya resuelta responde 409 en un segundo intento.

Actividad y deshacer: cada alta de ingreso/gasto/compra/presupuesto y cada transferencia (manual o confirmada por la IA) queda registrada en `financy_activity` con un resumen legible. `GET /activity` (con `?before=<id>` para paginar) devuelve `{"activity":[{id,source,kind,summary,created_at,undone_at,can_undo}],"has_more":bool}`; `source` distingue `user` de `ai`. `POST /activity/:id/undo` revierte la acción (elimina lo creado o invierte la transferencia) reutilizando las mismas reglas de negocio; solo `can_undo:true` es reversible, y una entrada ya deshecha o ajena responde 409.

Errores: `{"statusCode":400,"message":"..."}`. 400: validación/saldo; 401: sesión; 403: origen o confirmación; 404: inexistente o ajeno; 409: conflicto; 429: intentos excesivos; 503: dependencia o tasa no disponible. Los errores internos no incluyen SQL ni credenciales.
