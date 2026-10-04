# Estado y administración

[Índice](README.md)

- **Sin portada:** `/` ya no es una página. Con sesión lleva a `/inicio`; sin ella, a «Entrar» (y después al inicio).
- **`/status`:** versión, si la API y la base de datos responden y el enlace a la muestra de componentes. Solo la ve un administrador, que la tiene también en el menú de usuario («Estado»). Cualquier otra cuenta que entre en `/status` vuelve a `/inicio`.
- **`/componentes`:** la muestra de componentes, también solo para administradores (sin sesión, pide entrar).
- **Administrador:** la columna `isAdmin` de `user` (`false` por defecto). Better Auth la envía en la sesión pero no deja cambiarla desde la web (`input: false`). Cómo marcar una cuenta: [Publicación](deployment.md#administrador-de-la-plataforma).
- **Preferencias de cookies:** siguen en «Ajustes».
