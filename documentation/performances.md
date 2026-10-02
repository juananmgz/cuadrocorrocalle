# Actuaciones

[Índice](README.md)

Paso 1.8 (caso OA-05). Las medidas del escenario, el lado del público y la zona de música llegan en la fase 2; el repertorio y la convocatoria, en los pasos 1.9 y 1.10.

- **Inicio:** solo la cuadrícula curvada y, flotando a la izquierda, la lista de actuaciones: la próxima desde hoy (o la última) destacada con «Abrir», debajo hasta 4 más como tarjetas sueltas y «+ Crear actuación». En tablet y PC la lista queda fija a la izquierda (380 px) y la cuadrícula se centra en el espacio de su derecha: centro = (W − wl) / 2 + wl, con wl medido hasta el borde derecho de la lista. En el móvil la lista va en el flujo de la página.
- **Crear desde el inicio:** «+ Crear actuación» mueve la cámara sobre la misma cuadrícula (0,9 s): la esfera se aplana mientras la cámara gira de la vista en picado a la cenital y sube hasta que el escenario cabe mientras las tarjetas de la lista salen una tras otra hacia la izquierda (70 ms entre cada una) y entra la tarjeta «Nueva actuación». «Cancelar» las devuelve.
- **Escenario:** ancho y fondo en metros, con la nota «1 m = 1 cuadrado». «Cambiar» despliega en acordeón «1 cuadrado = [ ] m» (de 0,1 a 10 m). Se guardan en `stage_width_m`, `stage_depth_m` y `square_m` (1 por defecto).
- **Vista previa del escenario:** mientras se escriben las medidas, el escenario se dibuja sobre la cuadrícula, que queda alineada con sus bordes, y la cámara solo se mueve e inclina (sin zoom): cada cuadrado mide lo mismo que en la vista principal. Solo se aleja si el escenario, con 1 cuadrado de margen, no cabe en pantalla. La cruz del centro (sustituye a las líneas gruesas de 5×5) se recalcula al salir de las casillas del escenario y se oculta mientras hay cambios sin confirmar; con un número impar de cuadrados cae entre dos líneas.
- **Mis actuaciones** (`/actuaciones`): las del grupo activo, primero las más cercanas y al final las que no tienen fecha. «Nueva actuación» abre el formulario.
- **Datos:** título (obligatorio), lugar, fecha (solo el día), duración mínima y máxima en minutos (la mínima no puede superar la máxima) y notas.
- **Ficha** (`/actuaciones/:id`): sus datos con «Editar», «Duplicar» (crea «Copia de …»; cuando existan, copiará también repertorio y convocatoria) y «Borrar» (pide una segunda pulsación).
- **Grupo de Prueba:** admite una sola actuación; crear o duplicar otra responde `TRIAL_LIMIT`. El límite de 3 bailes llegará con el repertorio.

## API

Módulo propio con el prefijo `/api/actuaciones`, como prevé la arquitectura (gestor de actuaciones separado del de cuentas).

| Método | Ruta                              | Qué hace                                                                                 |
| ------ | --------------------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/api/actuaciones?grupo=:groupId` | Actuaciones del grupo                                                                    |
| POST   | `/api/actuaciones`                | Crea una actuación `{ groupId, title, place?, date?, minMinutes?, maxMinutes?, notes? }` |
| GET    | `/api/actuaciones/:id`            | Una actuación                                                                            |
| PATCH  | `/api/actuaciones/:id`            | Cambia sus datos                                                                         |
| POST   | `/api/actuaciones/:id/duplicar`   | La duplica                                                                               |
| DELETE | `/api/actuaciones/:id`            | La borra                                                                                 |

Solo el propietario del grupo puede usarlas (404 si no). Los esquemas están en `packages/shared/src/performances.ts`.
