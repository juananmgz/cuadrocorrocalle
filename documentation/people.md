# Personas

[Índice](README.md)

Paso 1.7 (caso OA-01). Pantalla «Mi grupo» (`/grupo`): información del grupo y sus personas. Una persona no es una cuenta: el director monta el grupo sin que nadie se registre.

- **Información:** nombre, color de cuadrícula, licencia (de momento «Grupo de prueba» o «Sin licencia») y número de personas.
- **Añadir persona:** nombre, muñeco (chico o chica), color principal entre los 20 y notas opcionales (instrumento, voz, talla…). El color propuesto es el siguiente de la paleta.
- **Pegar lista:** se pegan los nombres uno por línea o separados por comas o punto y coma. Se quitan la numeración («1.», «2)») y las viñetas, los espacios de más y los repetidos; se ve cuántas personas se van a añadir. Cada una recibe el siguiente color de la paleta y queda «Sin muñeco» hasta que el director lo elija. Máximo 200 de una vez.
- **Editar y borrar:** al tocar a una persona se abre su ficha; «Borrar» pide una segunda pulsación para confirmar.
- La lista se ordena por nombre. Al borrar el grupo se borran sus personas.

## Navegación

- **Móvil:** el menú lateral tiene «Mi grupo» entre «Actuaciones» y «Ajustes».
- **Tablet y PC:** la barra superior muestra las secciones «Actuaciones» y «Mi grupo».

## API

| Método | Ruta                                          | Qué hace                                                  |
| ------ | --------------------------------------------- | --------------------------------------------------------- |
| GET    | `/api/cuentas/grupos/:groupId/personas`       | Personas del grupo, ordenadas por nombre                  |
| POST   | `/api/cuentas/grupos/:groupId/personas`       | Añade una persona `{ name, figure?, mainColor?, notes? }` |
| POST   | `/api/cuentas/grupos/:groupId/personas/lista` | Añade una lista `{ names: string[] }`                     |
| PATCH  | `/api/cuentas/grupos/:groupId/personas/:id`   | Cambia sus datos                                          |
| DELETE | `/api/cuentas/grupos/:groupId/personas/:id`   | La borra                                                  |

Solo el propietario del grupo puede usarlas (404 si no). Los esquemas y el analizador de la lista pegada (`parseNameList`) están en `packages/shared/src/people.ts`.
