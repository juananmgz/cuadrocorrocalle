# Arquitectura

[Índice](README.md)

La web habla solo con su propia dirección: en producción, una Pages Function reenvía `/api/*` a la API; en local lo hace el proxy de Vite. Lo que aún no existe se construye en los pasos indicados.

```mermaid
flowchart LR
  U["Navegador: móvil, tablet, PC"] --> W["apps/web<br>Vite, React 19, React Router<br>tokens Tiza claro y oscuro (0.2)<br>componentes base sobre Radix (0.7)"]
  W -->|"/api (Pages Function en producción, proxy de Vite en local)"| A["apps/api<br>Fastify, puerto 3000<br>GET /api/health: API y base de datos<br>cuentas y actuaciones (fase 1)"]
  A --> D[("PostgreSQL en Neon<br>Prisma 7 con adaptador pg<br>rama dev para desarrollo (0.4)")]
  S["packages/shared<br>Zod: healthResponseSchema"] -.-> W
  S -.-> A
```
