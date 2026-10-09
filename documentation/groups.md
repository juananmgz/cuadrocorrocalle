# Grupos

[Índice](README.md)

Paso 1.5 (caso OA-26). Un usuario puede dirigir varios grupos; solo él los ve y los edita.

- **«Grupo de Prueba»:** cada cuenta nueva lo recibe al crearse (`databaseHooks` de Better Auth). Las cuentas antiguas sin grupos lo reciben la primera vez que piden sus grupos. Un administrador no tiene grupos de prueba: al pedir sus grupos, los de prueba pasan a definitivos (`makeDefinitive`), sin límites de actuaciones ni de piezas y se pueden borrar.
- **Elegir grupo:** es una página propia, `/grupos` (estilo selector de perfiles de Chrome), no un diálogo. Cada grupo es un cuadrado con las esquinas redondeadas, del color de su cuadrícula y con su inicial; encima, la etiqueta «Prueba» si es el de prueba (los demás dejan ese hueco vacío, para que los cuadrados queden alineados), y debajo su nombre. El grupo activo lleva un borde azul. El último cuadrado, discontinuo y con un lápiz, es «Modificar». Pulsar un grupo lo elige y lleva a `/inicio`. Si hay varios grupos y ninguno elegido, cualquier página con sesión lleva antes a `/grupos`. Con un solo grupo se entra directo. El recuadro del grupo en la barra superior abre la página; en el móvil, la barra solo lleva el logo y el menú hamburguesa, cuyo panel lateral muestra el grupo con «Cambiar de grupo».
- **Se recuerda 7 días:** el grupo elegido se guarda en el dispositivo (`localStorage`, clave `ccc-group`) con caducidad de una semana, que se renueva en cada visita. Al cerrar sesión se olvida.
- **Añadir grupo:** nombre (máx. 60 caracteres) y color de cuadrícula. Libre hasta la fase 5, cuando lo limitarán las [licencias](licensing.md).
- **Modificar grupos:** `/grupos/editar` lista los grupos, cada uno con su cuadrado pequeño, su nombre y dos botones: el lápiz abre debajo su nombre y su color, y la papelera roja lo borra (no sale en el de prueba). Debajo, «Añadir grupo» abre el mismo formulario para uno nuevo (más adelante pedirá su clave de licencia), y al final van las licencias que quedan y «Listo», que vuelve a elegir. Componentes en `pages/Groups` y formularios en `components/GroupForms`.
- **Borrar un grupo (paso 1.6):** desde «Modificar grupos», la papelera avisa de que se borra con todas sus personas y actuaciones y pide confirmarlo: la contraseña, o escribir el nombre del grupo si la cuenta se creó con Google y no tiene contraseña (sin distinguir mayúsculas ni acentos). Tras 5 intentos fallidos en 10 minutos se bloquea. El «Grupo de Prueba» no se puede borrar. Si era el grupo activo, se vuelve a elegir.
- **Licencias restantes:** el pie de «Modificar grupos» dice cuántos grupos más permiten tus licencias («Licencias disponibles para 2 grupos más»). Hasta la fase 5 no hay licencias, así que dice «No te quedan licencias para más grupos», aunque añadir grupos siga siendo libre mientras se desarrolla.
- **Color de cuadrícula:** 8 colores oscuros (azul, granate, verde, morado, petróleo, marrón, pizarra y vino), con un tono más claro en modo oscuro. El grupo activo pone `data-grid` en `<html>` y las líneas de la cuadrícula toman su color.

## API

| Método | Ruta                              | Qué hace                                                                                                     |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/cuentas/grupos`             | Grupos del usuario (crea el «Grupo de Prueba» si no tiene ninguno)                                           |
| POST   | `/api/cuentas/grupos`             | Crea un grupo `{ name, gridColor }`                                                                          |
| PUT    | `/api/cuentas/grupos/:id/figuras` | Guarda cómo aparece cada figura al ponerla `{ figureDefaults: { pair: { rotation, width }, … } }` (paso 2.2) |

Sin sesión responden 401. Los esquemas están en `packages/shared/src/groups.ts`.

- **Color en directo:** al elegir un color de cuadrícula (al crear o editar un grupo, o en el alta guiada), la cuadrícula cambia al momento con un fundido de 0,45 s. Si se sale sin guardar, vuelve el color anterior.
