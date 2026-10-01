# Seguridad de las cuentas

[Índice](README.md)

Cómo se protegen las contraseñas y las sesiones (paso 1.2).

## En el camino (red)

- **HTTPS en todo el recorrido de producción:** navegador → Cloudflare Pages → Render (`API_ORIGIN` es `https://…onrender.com`) → Neon (TLS con `sslmode=require`). La contraseña nunca viaja sin cifrar fuera del propio equipo; en local va por `localhost`, que no sale a la red.
- **HSTS:** `apps/web/public/_headers` obliga al navegador a usar siempre HTTPS durante un año, para que nadie pueda forzar una conexión sin cifrar en una wifi pública.
- **Content Security Policy:** el navegador solo ejecuta scripts de la propia web, el script del tema (por su hash) y Google Tag Manager; solo se conecta a la propia web y a Google Analytics; no admite plugins, marcos ajenos ni formularios hacia otros sitios. Un script inyectado por un fallo no podría enviar la contraseña a otro servidor. La prueba `src/security/csp.test.ts` falla si el script del tema cambia sin actualizar su hash en `_headers`.
- **Otras cabeceras:** `nosniff`, sin incrustar la web en marcos ajenos (`X-Frame-Options: DENY`), referer recortado y sin acceso a cámara, micrófono ni ubicación.

## Guardadas (base de datos)

- **Nunca se guarda la contraseña,** solo su hash con **scrypt** y una sal aleatoria por contraseña (Better Auth, `node:crypto`). Está en la tabla `account`, columna `password`.
- **Contraseñas filtradas:** al crear la cuenta (y al cambiar o restablecer la contraseña) se comprueba en Have I Been Pwned. Solo se envían los 5 primeros caracteres del hash SHA-1 (k-anonimato), nunca la contraseña. Si aparece en filtraciones, se pide otra.
- **Mínimo de 8 caracteres** y máximo de 128.

## Ataques de fuerza bruta

- **Límite de intentos por visitante:** 5 intentos de entrar y 3 registros por minuto y por IP; el resto de rutas de cuentas, 100 por minuto. Pasado el límite, la API responde 429 y la web pide esperar.
- **IP del visitante:** el proxy de Cloudflare la pasa en la cabecera `x-client-ip` (desde `cf-connecting-ip`).
- **Solo a través de la web:** el proxy añade `x-proxy-secret` con `PROXY_SECRET`, y la API responde 403 a cualquier petición sin esa clave (comparada en tiempo constante). Así nadie puede llamar directamente a `onrender.com` para falsear su IP y esquivar el límite. La única excepción es `/api/health`, que Render necesita para comprobar que la API está viva.
- Los contadores viven en memoria de la API: se reinician si Render la reinicia.

## Sesión

- Cookie `better-auth.session_token`: **HttpOnly** (JavaScript no puede leerla), **Secure** en producción, **SameSite=Lax** y firmada con `BETTER_AUTH_SECRET`.
- Las peticiones que cambian algo solo se aceptan desde el origen de la web (`trustedOrigins`), lo que frena el CSRF.
- Los registros de la API (Fastify) guardan método, ruta y estado, nunca el cuerpo de la petición, así que la contraseña no aparece en ellos.

## Correo (paso 1.3)

- **Confirmar el correo:** al crear la cuenta se envía un enlace que caduca en 24 horas. Se puede usar la cuenta antes de confirmarlo; `/inicio` recuerda que falta y permite reenviarlo.
- **Recuperar la contraseña:** `/recuperar` envía un enlace que caduca en 1 hora y sirve una sola vez. La respuesta es la misma exista o no la cuenta, para que nadie pueda averiguar qué correos están registrados.
- **Al cambiar la contraseña** se cierran las sesiones en todos los dispositivos, por si alguien más la conocía.
- **Límites:** 3 peticiones de recuperar contraseña y 3 reenvíos de confirmación por minuto y por IP.
- Los correos salen por la API HTTPS de Brevo (`BREVO_API_KEY`); en local, sin clave, se escriben en la consola de la API.

## Pendiente

- `style-src` permite estilos en línea (`'unsafe-inline'`) porque los componentes de Radix y algunos colores se aplican con el atributo `style`. El riesgo es bajo: los estilos no ejecutan código.
