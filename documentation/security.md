# Seguridad de las cuentas

[Índice](README.md)

Cómo se protegen las contraseñas y las sesiones (paso 1.2).

## En el camino (red)

- **HTTPS en todo el recorrido de producción:** navegador → Cloudflare Pages → Render (`API_ORIGIN` es `https://…onrender.com`) → Neon (TLS con `sslmode=require`). La contraseña nunca viaja sin cifrar fuera del propio equipo; en local va por `localhost`, que no sale a la red.
- **HSTS:** `apps/web/public/_headers` obliga al navegador a usar siempre HTTPS durante un año, para que nadie pueda forzar una conexión sin cifrar en una wifi pública.
- **Otras cabeceras:** `nosniff`, sin incrustar la web en marcos ajenos (`X-Frame-Options: DENY`), referer recortado y sin acceso a cámara, micrófono ni ubicación.

## Guardadas (base de datos)

- **Nunca se guarda la contraseña,** solo su hash con **scrypt** y una sal aleatoria por contraseña (Better Auth, `node:crypto`). Está en la tabla `account`, columna `password`.
- **Contraseñas filtradas:** al crear la cuenta (y al cambiar o restablecer la contraseña) se comprueba en Have I Been Pwned. Solo se envían los 5 primeros caracteres del hash SHA-1 (k-anonimato), nunca la contraseña. Si aparece en filtraciones, se pide otra.
- **Mínimo de 8 caracteres** y máximo de 128.

## Ataques de fuerza bruta

- **Límite de intentos por visitante:** 5 intentos de entrar y 3 registros por minuto y por IP; el resto de rutas de cuentas, 100 por minuto. Pasado el límite, la API responde 429 y la web pide esperar.
- **IP del visitante:** el proxy de Cloudflare la pasa en la cabecera `x-client-ip` (desde `cf-connecting-ip`).
- Los contadores viven en memoria de la API: se reinician si Render la reinicia.

## Sesión

- Cookie `better-auth.session_token`: **HttpOnly** (JavaScript no puede leerla), **Secure** en producción, **SameSite=Lax** y firmada con `BETTER_AUTH_SECRET`.
- Las peticiones que cambian algo solo se aceptan desde el origen de la web (`trustedOrigins`), lo que frena el CSRF.
- Los registros de la API (Fastify) guardan método, ruta y estado, nunca el cuerpo de la petición, así que la contraseña no aparece en ellos.

## Pendiente

- **Llamadas directas a Render:** la API también responde en su dirección de `onrender.com`, saltándose Cloudflare; ahí alguien podría falsear `x-client-ip` para esquivar el límite de intentos. Se cierra con una clave compartida entre el proxy y la API.
- **Content Security Policy:** pendiente de ajustar con Google Analytics y el script del tema.
- **Confirmar el correo y recuperar la contraseña:** paso 1.3.
