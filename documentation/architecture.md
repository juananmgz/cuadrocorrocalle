# Arquitectura

[Índice](README.md)

La web habla solo con su propia dirección: en producción, una Pages Function reenvía `/api/*` a la API; en local lo hace el proxy de Vite. Lo que aún no existe se construye en los pasos indicados.

```mermaid
flowchart LR
  U["Navegador: móvil, tablet, PC"] --> W["apps/web<br>Vite, React 19, React Router<br>tokens Tiza claro y oscuro (0.2)<br>componentes base sobre Radix (0.7)<br>selector de tema y 20 colores de persona (0.8)"]
  W -->|"/api (Pages Function en producción, proxy de Vite en local)"| A["apps/api<br>Fastify, puerto 3000<br>GET /api/health: API y base de datos<br>/api/auth/*: Better Auth con email y contraseña (1.2)<br>confirmar correo y recuperar contraseña (1.3)<br>entrar con Google (1.4)<br>/api/cuentas/grupos: listar y crear grupos (1.5)<br>personas y actuaciones (fase 1)"]
  A --> D[("PostgreSQL en Neon<br>Prisma 7 con adaptador pg<br>rama dev para desarrollo (0.4)")]
  W -.->|"solo si se aceptan las cookies (1.1)"| GA["Google Analytics 4"]
  A -->|"correos de cuenta (1.3)"| BR["Brevo<br>API transaccional"]
  U -.->|"OAuth (1.4)"| GO["Google"]
  A -->|"código OAuth"| GO
  S["packages/shared<br>Zod: healthResponseSchema"] -.-> W
  S -.-> A
```

**Acceso a la API:** solo a través de la web. El proxy añade la clave `PROXY_SECRET` y la IP del visitante; la API rechaza lo demás salvo `/api/health`.

**Sesión:** Better Auth guarda la sesión en la cookie `better-auth.session_token` (HttpOnly, SameSite=Lax, 30 días que se renuevan con el uso). Como la web y la API comparten dirección gracias al proxy, la cookie es de la propia web y funciona igual en el móvil y en el PC. Más detalle en [Seguridad de las cuentas](security.md).
