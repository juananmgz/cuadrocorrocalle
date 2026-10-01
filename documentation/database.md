# Base de datos

[Índice](README.md)

PostgreSQL en Neon con Prisma 7. El esquema está en `apps/api/prisma/schema.prisma` y las migraciones en `apps/api/prisma/migrations`.

Migraciones:

- `20260930144317_init` (paso 0.4): tabla técnica `app_meta`.
- `20261001132908_auth` (paso 1.2): tablas de Better Auth para las cuentas.

Las tablas de Better Auth (`user`, `session`, `account`, `verification`) usan sus nombres por defecto, en singular y con columnas en camelCase, porque Better Auth comprueba el esquema al arrancar. El resto de tablas usa nombres en inglés y columnas en snake_case. Tras cambiar `schema.prisma`, ejecuta `pnpm --filter @cuadrocorrocalle/api db:migrate` y después `db:generate`.

```mermaid
erDiagram
  app_meta {
    text key PK
    text value
    timestamp updated_at
  }
  user ||--o{ session : "tiene"
  user ||--o{ account : "entra con"
  user {
    text id PK
    text name
    text email UK
    boolean emailVerified
    text image
    timestamp createdAt
    timestamp updatedAt
  }
  session {
    text id PK
    text token UK
    timestamp expiresAt
    text ipAddress
    text userAgent
    text userId FK
  }
  account {
    text id PK
    text accountId
    text providerId "credential, google..."
    text userId FK
    text password "hash; solo email y contraseña"
    text accessToken
    text refreshToken
    text idToken
    text scope
  }
  verification {
    text id PK
    text identifier
    text value
    timestamp expiresAt
  }
```

## Ramas de Neon

- `dev`: desarrollo en local, desde `apps/api/.env`.
- Principal: producción, configurada en Render.
