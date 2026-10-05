# Grupos

[Índice](README.md)

Paso 1.5 (caso OA-26). Un usuario puede dirigir varios grupos; solo él los ve y los edita.

- **«Grupo de Prueba»:** cada cuenta nueva lo recibe al crearse (`databaseHooks` de Better Auth). Las cuentas antiguas sin grupos lo reciben la primera vez que piden sus grupos.
- **Elegir grupo:** al entrar en `/inicio`, si hay varios grupos y ninguno elegido, sale el diálogo «Elegir grupo» (estilo selector de perfiles de Chrome) y no se puede cerrar sin elegir. Con un solo grupo se entra directo. El recuadro del grupo en la barra superior vuelve a abrirlo; en el móvil, la barra solo lleva el logo y el menú hamburguesa, cuyo panel lateral muestra el grupo con «Cambiar de grupo».
- **Se recuerda 7 días:** el grupo elegido se guarda en el dispositivo (`localStorage`, clave `ccc-group`) con caducidad de una semana, que se renueva en cada visita. Al cerrar sesión se olvida.
- **Crear grupo:** nombre (máx. 60 caracteres) y color de cuadrícula. Libre hasta la fase 5, cuando lo limitarán las [licencias](licensing.md).
- **Editar grupos:** como en Netflix, el botón «Editar grupos» del diálogo pone un lápiz sobre cada grupo; al pulsarlo se cambian su nombre y su color. «Listo» vuelve a elegir.
- **Borrar un grupo (paso 1.6):** desde «Editar grupo», el botón «Borrar grupo» avisa de que se borra con todas sus personas y actuaciones y pide confirmarlo: la contraseña, o escribir el nombre del grupo si la cuenta se creó con Google y no tiene contraseña (sin distinguir mayúsculas ni acentos). Tras 5 intentos fallidos en 10 minutos se bloquea. El «Grupo de Prueba» no se puede borrar. Si era el grupo activo, se vuelve a elegir.
- **Licencias restantes:** el pie del diálogo dice cuántos grupos más permiten tus licencias («Licencias disponibles para 2 grupos más»). Hasta la fase 5 no hay licencias, así que dice «No te quedan licencias para más grupos», aunque crear grupos siga siendo libre mientras se desarrolla.
- **Color de cuadrícula:** 8 colores oscuros (azul, granate, verde, morado, petróleo, marrón, pizarra y vino), con un tono más claro en modo oscuro. El grupo activo pone `data-grid` en `<html>` y las líneas de la cuadrícula toman su color.

## API

| Método | Ruta                              | Qué hace                                                                                                     |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/cuentas/grupos`             | Grupos del usuario (crea el «Grupo de Prueba» si no tiene ninguno)                                           |
| POST   | `/api/cuentas/grupos`             | Crea un grupo `{ name, gridColor }`                                                                          |
| PUT    | `/api/cuentas/grupos/:id/figuras` | Guarda cómo aparece cada figura al ponerla `{ figureDefaults: { pair: { rotation, width }, … } }` (paso 2.2) |

Sin sesión responden 401. Los esquemas están en `packages/shared/src/groups.ts`.

- **Color en directo:** al elegir un color de cuadrícula (al crear o editar un grupo, o en el alta guiada), la cuadrícula cambia al momento con un fundido de 0,45 s. Si se sale sin guardar, vuelve el color anterior.
