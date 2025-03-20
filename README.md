# FINANCY

FINANCY es una aplicación para gestionar las finanzas personales de los usuarios. Permite a los usuarios registrar y gestionar sus ingresos, gastos, ahorros y listas de compras. La aplicación está construida utilizando una combinación de tecnologías modernas como React, Inertia.js, Laravel, Tailwind CSS y MySQL.

## Tecnologías Utilizadas

- **React**: Utilizado para construir la interfaz de usuario interactiva.
- **Inertia.js**: Facilita la integración entre Laravel y React, permitiendo construir aplicaciones de una sola página (SPA) sin necesidad de una API separada.
- **Laravel**: Framework de PHP utilizado para manejar la lógica del servidor y las operaciones de base de datos.
- **Tailwind CSS**: Framework de CSS utilizado para diseñar la interfaz de usuario.
- **MySQL**: Base de datos utilizada para almacenar la información de los usuarios.
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