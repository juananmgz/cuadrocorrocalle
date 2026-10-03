# Personas

[Índice](README.md)

Paso 1.7 (caso OA-01). Pantalla «Mi grupo» (`/grupo`): información del grupo y sus personas. Una persona no es una cuenta: el director monta el grupo sin que nadie se registre.

- **Información:** nombre, color de cuadrícula, licencia (de momento «Grupo de prueba» o «Sin licencia») y número de personas.
- **Añadir persona:** nombre, género (chico o chica, obligatorio), tipo («Principal» o «Colaborador»; cambiarlo mueve a la persona de grupo), roles (Baile, Música, Canto; al menos uno, varios a la vez y ampliables), color principal entre los 20 y notas opcionales (instrumento, voz, talla…). El color empieza en «?» (aleatorio, primera opción): al guardar se elige uno de los 20 al azar.
- **Pegar lista:** en dos pasos. Primero se elige «Una lista» (chicos y chicas juntos) o «Chicos y chicas por separado» (dos cuadros de texto) y se pegan los nombres, uno por línea o separados por comas o punto y coma; se quitan la numeración («1.», «2)»), las viñetas, los espacios de más y los repetidos. Al pulsar «Siguiente» sale cada persona con los mismos botones de «Añadir persona»: género (solo en la lista conjunta; con dos listas ya viene dado) y roles, más una fila «Todos» que da o quita un rol a todos. Quien aún no tiene género o rol sale en amarillo y «Añadir N personas» no se activa hasta completarlos; «Atrás» conserva lo marcado y «Cancelar» lo descarta. Si el grupo ya tiene personas, la casilla «Reemplazar la lista actual» borra antes a todas (y sus convocatorias); pide la misma confirmación que borrar un grupo: la contraseña o, en cuentas de Google, escribir el nombre del grupo. Cada persona recibe el siguiente color de la paleta. Máximo 200 de una vez.
- **Lista y filtros:** la página es más ancha (hasta 1440 px); desde 1024 px la información va a la izquierda (4 de 12 columnas) y los miembros a la derecha (8 de 12); la página cabe en la ventana y las tarjetas tienen alto fijo: solo se desplaza su contenido (la lista, con la fila de títulos fija arriba), y título, filtros y «Borrar todos los miembros» quedan siempre a la vista y hay una persona por fila: nombre, roles («Sin rol» si no tiene) y género. Cada rol tiene su hueco fijo en la columna (Baile, Música, Canto, en ese orden), así que las etiquetas iguales quedan alineadas aunque falte alguna, y su borde lleva color: baile amarillo, música morado y canto verde. La tarjeta se titula «Miembros» y lleva «Añadir persona» y «Pegar lista» al final de la misma fila. Debajo, un buscador por nombre (sin tener en cuenta tildes ni mayúsculas) y la casilla «Separar por género». La fila de títulos (Nombre, Rol, Género) va sobre un fondo de color y ordena la lista al pulsarla. Nombre y Género invierten el orden al pulsar otra vez. Rol va rotando: primero quien baila, luego quien toca música, luego quien canta y vuelta a empezar; junto al título aparece la etiqueta del rol que va arriba, con su color. Quien no tiene rol o género va al final. El género se muestra centrado, como etiqueta con borde rojo pastel (chico) o azul (chica). Los miembros van en el grupo plegable «Principales (N)» y los colaboradores al final en «Colaboradores (N)». Al separar por género, cada persona se desliza a su sitio (0,45 s): chicos a un lado y chicas al otro, cada columna con sus dos grupos; quien no tiene género va debajo, en «Sin género». Ordenar, plegar o separar también desliza las filas a su nuevo sitio. «Personas» en la información muestra el total y cuántos son miembros y colaboradores.
- **Borrar todos los miembros:** al final de la lista; pide la misma confirmación que borrar un grupo y quita también a esas personas de las convocatorias. La confirmación es un componente común (`components/ConfirmIdentity` y `auth/confirmation.ts` en la web, `auth/confirmIdentity.ts` en la API, con el mismo límite de 5 intentos fallidos cada 10 minutos).
- **Editar y borrar:** al tocar a una persona se abre su ficha; «Borrar» pide una segunda pulsación para confirmar.
- La lista se ordena por nombre. Al borrar el grupo se borran sus personas.

## Navegación

- **Móvil:** el menú lateral tiene «Mi grupo» encima de «Ajustes».
- **Tablet y PC:** la barra superior muestra la sección «Mi grupo».

## API

| Método | Ruta                                          | Qué hace                                                                                                                                                        |
| ------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/cuentas/grupos/:groupId/personas`       | Personas del grupo, ordenadas por nombre                                                                                                                        |
| POST   | `/api/cuentas/grupos/:groupId/personas`       | Añade una persona `{ name, figure?, membership?, roles?, mainColor?, notes? }`                                                                                  |
| POST   | `/api/cuentas/grupos/:groupId/personas/lista` | Añade una lista `{ names: (nombre o { name, figure?, roles? })[], membership?, replace? }`; con `replace` borra antes a todos y pide `password` o `confirmName` |
| PATCH  | `/api/cuentas/grupos/:groupId/personas/:id`   | Cambia sus datos                                                                                                                                                |
| DELETE | `/api/cuentas/grupos/:groupId/personas/:id`   | La borra                                                                                                                                                        |
| DELETE | `/api/cuentas/grupos/:groupId/personas`       | Borra a todos con `{ password }` o `{ confirmName }`                                                                                                            |

Solo el propietario del grupo puede usarlas (404 si no). Los esquemas y el analizador de la lista pegada (`parseNameList`) están en `packages/shared/src/people.ts`.
