# Actuaciones

[Índice](README.md)

Paso 1.8 (caso OA-05). Las medidas del escenario, el lado del público y la zona de música llegan en la fase 2; el repertorio y la convocatoria, en los pasos 1.9 y 1.10.

- **Inicio:** solo la cuadrícula curvada y, flotando a la izquierda, la lista de actuaciones: la próxima desde hoy (o la última) destacada con «Abrir», debajo hasta 4 más como tarjetas sueltas y «+ Crear actuación». En tablet y PC la lista queda fija a la izquierda (380 px) y la cuadrícula se centra en el espacio de su derecha: centro = (W − wl) / 2 + wl, con wl medido hasta el borde derecho de la lista. En el móvil la lista va en el flujo de la página.
- **Crear desde el inicio:** «+ Crear actuación» mueve la cámara sobre la misma cuadrícula (1,2 s), como en el prototipo «Escenario en picado»: gira alrededor del centro de la vista en picado a la cenital mientras se aleja y cierra el objetivo (dolly zoom), así que el cuadrado del centro no cambia de tamaño, la perspectiva se aplana y la curvatura del suelo se endereza. A la vez, las tarjetas de la lista salen una tras otra hacia la izquierda (70 ms entre cada una) y entra la tarjeta «Nueva actuación». Cuando la cámara se ha asentado, aparece el escenario (fundido de 0,35 s creciendo desde el centro). «Cancelar» lo hace al revés: primero se oculta el escenario y luego vuelve la cámara. Si el escenario ya está a la vista, la cámara se mueve con él.
- **Escenario:** ancho (de 4 a 100 m) y fondo (de 2 a 100 m) en metros enteros, que al salir del campo se ajustan al límite más cercano, y «Borde» (0,25 m por defecto y mínimo; si se escribe menos, vuelve a 0,25 al salir del campo; máximo 10 m), con la nota «1 cuadrado = 0,5 m». «Cambiar» despliega en acordeón «1 cuadrado = [ ] m» (de 0,1 a 10 m). Se guardan en `stage_width_m`, `stage_depth_m`, `edge_distance_m` y `square_m` (0,5 por defecto).
- **Campos filtrados:** cada campo solo admite lo que le corresponde. Título y lugar: letras (con acentos), números, espacios y la puntuación habitual. Duraciones, ancho y fondo: solo números enteros. Escala y borde: números con coma o punto y hasta dos decimales.
- **Vista previa del escenario:** cada medida se aplica al salir de su campo (así, al cambiar 10 por 9 no pasa por 1 ni por vacío); el escenario se dibuja sobre la cuadrícula, que queda alineada con sus bordes, y la cámara solo se mueve e inclina (sin zoom): cada cuadrado mide lo mismo que en la vista principal. Solo se aleja si el escenario, con 1 cuadrado de margen, no cabe en pantalla. La cruz del centro (sustituye a las líneas gruesas de 5×5) está siempre visible y se mueve con el escenario al aplicar cada medida; con un número impar de cuadrados cae entre dos líneas.
- **Cambio de tamaño:** al cambiar el ancho o el fondo, los cuadrados se añaden o se quitan por el medio (0,45 s): las dos mitades se separan o se juntan desde el centro, como placas tectónicas, y los cuadrados nuevos nacen en el centro mientras los que sobran se cierran y se desvanecen.
- **Borde:** se dibuja dentro del escenario como otro rectángulo con borde discontinuo, a esa distancia de cada lado.
- **Sin página de listado:** las actuaciones se ven y se crean desde el inicio; ya no existen `/actuaciones` ni el formulario emergente de crear. El inicio tendrá más adelante una opción para ver todas.
- **Bloques en acordeón:** el formulario de crear tiene dos bloques, «Nueva actuación» (datos y escenario) y «Convocatoria». Solo uno está abierto; el cerrado muestra un resumen (título y medidas, o cuántos vienen) y se abre pulsando su título. Cada bloque acaba en «Continuar»: el de datos comprueba el título y abre la convocatoria; el de convocatoria la cierra. «Cancelar» y «Crear actuación» van abajo, centrados en el espacio libre, debajo de «PÚBLICO».
- **Convocatoria** (paso 1.9): pestañas «Pegar», «Importar» (.txt, o la primera columna de un .csv) y «A mano». «Marcar en la convocatoria» (o elegir el fichero) relaciona cada nombre con una persona del grupo, la marca como «Viene» y pasa a «A mano» para revisarla. La relación no usa lista de apodos: ignora tildes, mayúsculas y signos y puntúa erratas, iniciales («M. Luisa») y apodos hechos con partes del nombre («Malú» = María Luisa). Las relaciones dudosas (parecido bajo, empate como dos «Pablo» o la misma persona dos veces) llevan la etiqueta amarilla «Revisar: «nombre pegado»». Los nombres que no están en el grupo salen arriba en rojo, con «Crear» y «No incluir» en cada uno y «Crear N miembros nuevos», y bloquean «Continuar» y «Crear actuación» hasta resolverlos; las personas creadas así entran como colaboradoras. En «A mano» se ve todo el grupo con «Viene», «No viene» y «Por confirmar» (pulsar otra vez lo quita). Aviso fijo: hay que revisar la convocatoria porque al pegar o importar puede haber nombres mal escritos.
- **Datos:** título (obligatorio), lugar, fecha (solo el día), duración mínima y máxima en minutos (la mínima no puede superar la máxima) y notas.
- **Ficha** (`/actuaciones/:id`): sus datos con «Editar», «Duplicar» (crea «Copia de …» con la misma convocatoria; cuando exista, copiará también el repertorio) y «Borrar» (pide una segunda pulsación y vuelve al inicio). «Editar» abre el formulario emergente de edición; «← Inicio» vuelve al inicio.
- **Grupo de Prueba:** admite una sola actuación; crear o duplicar otra responde `TRIAL_LIMIT`. El límite de 3 bailes llegará con el repertorio.

## API

Módulo propio con el prefijo `/api/actuaciones`, como prevé la arquitectura (gestor de actuaciones separado del de cuentas).

| Método | Ruta                                | Qué hace                                                                                 |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/api/actuaciones?grupo=:groupId`   | Actuaciones del grupo                                                                    |
| POST   | `/api/actuaciones`                  | Crea una actuación `{ groupId, title, place?, date?, minMinutes?, maxMinutes?, notes? }` |
| GET    | `/api/actuaciones/:id`              | Una actuación                                                                            |
| PATCH  | `/api/actuaciones/:id`              | Cambia sus datos                                                                         |
| POST   | `/api/actuaciones/:id/duplicar`     | La duplica                                                                               |
| DELETE | `/api/actuaciones/:id`              | La borra                                                                                 |
| GET    | `/api/actuaciones/:id/convocatoria` | Convocatoria `{ entries: [{ personId, status }] }` con status `yes`, `no` o `maybe`      |
| PUT    | `/api/actuaciones/:id/convocatoria` | La sustituye entera; las personas deben ser del grupo (400 si no)                        |

Solo el propietario del grupo puede usarlas (404 si no). Los esquemas están en `packages/shared/src/performances.ts` y `packages/shared/src/callUps.ts`.
