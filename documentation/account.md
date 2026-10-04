# Mi cuenta

[Índice](README.md)

Paso 1.14 (caso OA-09). Página `/cuenta`, desde el menú de usuario.

- **Nombre:** se cambia y se guarda con «Guardar nombre» (`authClient.updateUser`).
- **Correo:** se escribe el nuevo y «Cambiar correo» envía un enlace a esa dirección (Better Auth, `user.changeEmail`). La cuenta sigue con el correo anterior hasta que se abre el enlace, que vuelve a `/cuenta?correo=cambiado` con el aviso «Correo cambiado». El correo de confirmación es propio («Confirma tu nuevo correo»): la API lo distingue del de una cuenta nueva porque el token lleva `updateTo`.
- **Contraseña:** la actual y la nueva (al menos 8 caracteres, y no puede aparecer en filtraciones conocidas). Al cambiarla se cierra la sesión en los demás dispositivos. Las cuentas que solo entran con Google no tienen contraseña y lo dice.
- **Sesión:** «Cerrar sesión».
- **Borrar la cuenta:** «Borrar mi cuenta» abre un diálogo que pide la contraseña, o escribir el correo de la cuenta si entra con Google. Borra la cuenta y, en cascada, sus grupos con sus personas, actuaciones y piezas, sus sesiones y sus formas de entrar. Después cierra la sesión y lleva a «Entrar».

## API

| Método | Ruta              | Qué hace                                                                                                                                  |
| ------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| DELETE | `/api/cuentas/yo` | Borra la cuenta con `{ password }` o `{ confirmName }` (el correo). 403 con `WRONG_PASSWORD` o `WRONG_NAME`; 429 tras 5 intentos fallidos |

Nombre, correo y contraseña van por las rutas de Better Auth (`/api/auth/update-user`, `/api/auth/change-email`, `/api/auth/change-password`).
