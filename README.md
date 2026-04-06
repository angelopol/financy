# FINANCY

FINANCY es una aplicación para gestionar las finanzas personales de los usuarios. Permite a los usuarios registrar y gestionar sus ingresos, gastos, ahorros y listas de compras. La aplicación está construida utilizando una combinación de tecnologías modernas como React, Inertia.js, Laravel, Tailwind CSS y MySQL.

## Tecnologías Utilizadas

- **React**: Utilizado para construir la interfaz de usuario interactiva.
- **Inertia.js**: Facilita la integración entre Laravel y React, permitiendo construir aplicaciones de una sola página (SPA) sin necesidad de una API separada.
- **Laravel**: Framework de PHP utilizado para manejar la lógica del servidor y las operaciones de base de datos.
- **Tailwind CSS**: Framework de CSS utilizado para diseñar la interfaz de usuario.
- **MySQL / PostgreSQL (Supabase)**: Base de datos de origen y destino para la migración de datos.
- **Cron de Laravel**: Utilizado para ejecutar tareas programadas, como la actualización de ingresos y gastos recurrentes.

## Estructura del Proyecto

### Modelos

- **Earning**: Representa los ingresos de los usuarios. Puede ser recurrente o único.
- **Expense**: Representa los gastos de los usuarios. Puede ser recurrente o único.
- **Box**: Representa una caja de ahorros específica del usuario.
- **Saving**: Representa los ahorros generales del usuario.
- **ShopListItem**: Representa los ítems en la lista de compras del usuario.

### Migraciones

Las migraciones se utilizan para definir la estructura de las tablas en la base de datos. Algunas de las migraciones clave incluyen:

- **create_earnings_table**: Define la estructura de la tabla de ingresos.
- **create_expenses_table**: Define la estructura de la tabla de gastos.
- **create_boxes_table**: Define la estructura de la tabla de cajas.
- **create_savings_table**: Define la estructura de la tabla de ahorros.
- **create_shop_list_items_table**: Define la estructura de la tabla de ítems de la lista de compras.

### Controladores

Los controladores manejan la lógica de la aplicación y las interacciones del usuario. Algunos de los controladores clave incluyen:

- **EarningsController**: Maneja las operaciones relacionadas con los ingresos, como la creación, actualización y eliminación de ingresos.
- **ExpensesController**: Maneja las operaciones relacionadas con los gastos, como la creación, actualización y eliminación de gastos.
- **DashboardController**: Muestra el tablero principal con un resumen de las finanzas del usuario.
- **ShopListController**: Maneja las operaciones relacionadas con la lista de compras, como la creación, actualización y eliminación de ítems de la lista de compras.
- **ProfileController**: Maneja las operaciones relacionadas con el perfil del usuario, como la edición y eliminación del perfil.

### Rutas

Las rutas definen los endpoints de la aplicación y los controladores que manejan las solicitudes a esos endpoints. Algunas de las rutas clave incluyen:

- **/dashboard**: Muestra el tablero principal.
- **/earnings**: Muestra y maneja las operaciones relacionadas con los ingresos.
- **/expenses**: Muestra y maneja las operaciones relacionadas con los gastos.
- **/shop-list**: Muestra y maneja las operaciones relacionadas con la lista de compras.
- **/profile**: Muestra y maneja las operaciones relacionadas con el perfil del usuario.

### Plantilla de Autenticación de Laravel

FINANCY utiliza la plantilla de autenticación proporcionada por Laravel para manejar el registro, inicio de sesión y gestión de usuarios. Esta plantilla incluye componentes de React para los formularios de autenticación y utiliza Inertia.js para manejar las transiciones de página sin recargar la página completa.

### Tareas Programadas

La aplicación utiliza el cron de Laravel para ejecutar tareas programadas, como la actualización de ingresos y gastos recurrentes. Estas tareas se definen en el comando `amounts:cron` y se ejecutan periódicamente para mantener actualizadas las finanzas del usuario.

## Migracion a Supabase (PostgreSQL)

Este proyecto incluye un flujo de migracion para mover un dump MySQL (`.sql`) hacia Supabase PostgreSQL sin perder informacion.

### 1. Configuracion Laravel para Supabase

Usa estos valores en tu `.env` de despliegue (no en el repositorio):

```env
DB_CONNECTION=pgsql
DB_HOST=db.YOUR_PROJECT_REF.supabase.co
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres
DB_PASSWORD=your-supabase-db-password
DB_SSLMODE=require
```

### 2. Script de migracion incluido

Archivo: `scripts/migrate-mysql-dump-to-supabase.ps1`

Requisitos:

- Docker Desktop activo.
- Proyecto Supabase creado.
- Password de base de datos de Supabase.
- Dump MySQL en formato `.sql`.

Ejemplo de ejecucion:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\migrate-mysql-dump-to-supabase.ps1 `
	-DumpPath "C:\ruta\a\financy_backup.sql" `
	-SupabaseHost "db.TU_PROJECT_REF.supabase.co" `
	-SupabasePassword "TU_SUPABASE_DB_PASSWORD"
```

Que hace el script:

- Levanta un MySQL temporal en Docker.
- Importa tu dump `.sql`.
- Migra esquema + datos a Supabase con `pgloader`.
- Preserva identificadores con mayusculas/minusculas (`quote identifiers`) para evitar romper columnas como `NextClaim` y `UpdatedTerm`.
- Verifica conteo de filas por tabla entre origen y destino.
- Genera reporte CSV en `storage/logs/supabase-row-count-check-*.csv`.

### 2.1 Alternativa sin Docker (SQL ya generado)

Cuando no hay Docker disponible, puedes usar el SQL de datos ya adaptado para PostgreSQL/Supabase:

- Archivo generado: `database/supabase/financy-data-import.sql`
- Script generador: `scripts/build-supabase-data-import-from-mysql-dump.ps1`

Regenerar archivo de importacion desde un dump MySQL:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-supabase-data-import-from-mysql-dump.ps1 `
	-InputDumpPath .\u619022423_financy.sql `
	-OutputSqlPath .\database\supabase\financy-data-import.sql
```

Notas de esta alternativa:

- Convierte identificadores MySQL con comillas invertidas a comillas dobles de PostgreSQL.
- Mantiene columnas sensibles a mayusculas/minusculas (por ejemplo `NextClaim` y `UpdatedTerm`).
- Reordena inserts para respetar dependencias de claves foraneas.
- Ajusta secuencias de `id` al final del import.

Para ejecutar en Supabase:

1. Crea el esquema con migraciones de Laravel apuntando a Supabase (`php artisan migrate --force`).
2. Ejecuta el contenido de `database/supabase/financy-data-import.sql` en el SQL Editor de Supabase.

### 3. Recomendaciones de seguridad

- Ejecutar la migracion sobre un proyecto Supabase nuevo o con esquema `public` vacio.
- Mantener un respaldo adicional del dump original.
- No versionar credenciales reales en archivos `.env` dentro del repositorio.

### 4. Verificacion en Laravel

Despues de migrar:

```powershell
php artisan config:clear
php artisan cache:clear
php artisan migrate:status
```

Si `migrate:status` muestra las migraciones historicas, la tabla `migrations` tambien se migro correctamente.