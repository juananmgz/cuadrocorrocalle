# Base de datos

[Índice](README.md)

PostgreSQL en Neon con Prisma 7. El esquema está en `apps/api/prisma/schema.prisma` y las migraciones en `apps/api/prisma/migrations`.

Migraciones:

- `20260930144317_init` (paso 0.4): tabla técnica `app_meta`.
- `20261001132908_auth` (paso 1.2): tablas de Better Auth para las cuentas.
- `20261002083115_groups` (paso 1.5): grupos de cada usuario.
- `20261002101204_people` (paso 1.7): personas de cada grupo.
- `20261002131629_performances` (paso 1.8): actuaciones de cada grupo.
- `20261002135920_performance_stage`: medidas del escenario y metros por cuadrado de cada actuación.

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
  user ||--o{ groups : "es propietario"
  groups {
    text id PK
    text owner_id FK
    text name
    text grid_color "azul, granate, verde…"
    boolean is_trial "Grupo de Prueba"
    timestamp inactive_since
    timestamp created_at
  }
  groups ||--o{ people : "tiene"
  people {
    text id PK
    text group_id FK
    text name
    text figure "boy, girl o vacío"
    text main_color "blue, red… (20)"
    text notes
  }
  groups ||--o{ performances : "tiene"
  performances {
    text id PK
    text group_id FK
    text title
    text place
    date date "solo el día"
    int min_minutes
    int max_minutes
    text notes
    float stage_width_m
    float stage_depth_m
    float square_m "0,5 por defecto"
    float edge_distance_m "0,25 por defecto y mínimo"
  }
  verification {
    text id PK
    text identifier
    text value
    timestamp expiresAt
  }
```

## Modelo completo previsto

Todas las tablas del plan, incluidas las que aún no existen. Cada una se crea en el paso que la necesita; el nombre de la fase o del paso aparece en algunas columnas. Las reglas de licencias están en [Licencias](licensing.md).

```mermaid
erDiagram
  user ||--o{ session : "inicia"
  user ||--o{ account : "entra con"
  user ||--o{ groups : "es propietario"
  user |o--o{ people : "puede ser"
  user ||--o{ license_keys : "genera (admin)"
  user ||--o{ licenses : "tiene varias"
  license_keys |o--o| licenses : "se canjea en"
  licenses |o--o{ groups : "cubre (hasta max_groups)"
  groups ||--o{ people : "tiene"
  groups ||--o{ performances : "tiene"
  groups ||--o{ costume_columns : "define"
  people ||--o{ call_ups : "convocada en"
  performances ||--o{ call_ups : "convoca"
  performances ||--o{ share_links : "se comparte con"
  share_links ||--o{ share_views : "abierto por"
  people ||--o{ share_views : "se identifica"
  performances ||--o{ pieces : "repertorio"
  pieces ||--o{ participations : "quién sale"
  call_ups ||--o{ participations : "solo convocados"
  pieces ||--o{ figures : "tiene"
  figures ||--o{ positions : "huecos"
  people |o--o{ positions : "ocupa"
  positions ||--o{ candidates : "por decidir"
  people ||--o{ candidates : "opción"
  people ||--o{ puppet_colors : "colores"
  pieces |o--o{ puppet_colors : "cambio de traje"
  people ||--o{ costume_values : "lleva"
  costume_columns ||--o{ costume_values : "celda"

  user {
    text id PK
    text name
    text email UK
    boolean emailVerified
    text image
    boolean isAdmin "fase 5"
  }
  session {
    text id PK
    text userId FK
    text token UK
    timestamp expiresAt
  }
  account {
    text id PK
    text userId FK
    text providerId "credential o google"
    text password "hash scrypt"
  }
  verification {
    text id PK
    text identifier
    text value
    timestamp expiresAt
  }
  groups {
    text id PK
    text owner_id FK
    text name
    text grid_color
    boolean is_trial "Grupo de Prueba"
    timestamp inactive_since "tras migrar la licencia"
    text license_id FK "vacío = sin licencia"
  }
  licenses {
    text id PK
    text user_id FK
    text license_key_id FK,UK "clave canjeada"
    int max_groups "1, N o vacío = ilimitados"
    timestamp starts_at
    timestamp expires_at "vacío = para siempre"
    timestamp last_migrated_at "una vez cada 6 meses"
    timestamp reuse_until "plaza libre: 1 mes"
  }
  license_keys {
    text id PK
    text code UK
    int max_groups
    int duration_days "vacío = para siempre"
    text sent_to_email
    text created_by FK
    text redeemed_by FK
    timestamp redeemed_at
  }
  people {
    text id PK
    text group_id FK
    text user_id FK "opcional"
    text name
    text figure "chico o chica"
    text main_color "p1 a p20"
  }
  performances {
    text id PK
    text group_id FK
    text title
    text place
    date date
    int min_minutes
    int max_minutes
    text audience_side
    int stage_width_m
    int stage_depth_m
    text music_side
    int music_size
  }
  call_ups {
    text performance_id PK,FK
    text person_id PK,FK
    text status "viene, no viene, por confirmar"
  }
  share_links {
    text id PK
    text performance_id FK
    text code UK
    boolean active
  }
  share_views {
    text id PK
    text share_link_id FK
    text person_id FK
    timestamp viewed_at
  }
  pieces {
    text id PK
    text performance_id FK
    int position
    text title
    text type "baile, canción, ambos"
    int duration_s
    boolean optional
    text audience_side "si cambia"
    text music_side "si cambia"
  }
  participations {
    text id PK
    text piece_id FK
    text performance_id FK
    text person_id FK
    text role "baila, toca, canta"
    text instrument
  }
  figures {
    text id PK
    text piece_id FK
    text kind "fila, corro, libre, unidad, simple, fija"
    int cell_x
    int cell_y
    int rotation
    boolean mirrored
    int length_m
    int width_m
    int depth_m
    text layout "serie o batería"
  }
  positions {
    text id PK
    text figure_id FK "o zona de música"
    text slot
    int music_cell_x
    int music_cell_y
    text person_id FK "vacío si por decidir"
  }
  candidates {
    text position_id PK,FK
    text person_id PK,FK
  }
  puppet_colors {
    text id PK
    text person_id FK
    text piece_id FK "si cambia de traje"
    text body
    text bottom
    text socks
    text shoes
    text headwear
  }
  costume_columns {
    text id PK
    text group_id FK
    text table "chicas o chicos"
    text name
    boolean required
    int position
  }
  costume_values {
    text column_id PK,FK
    text person_id PK,FK
    text value
    text lender
  }
  app_meta {
    text key PK
    text value
  }
```

`participations` apunta a la convocatoria (`performance_id` + `person_id`), así que la base de datos impide que salga en una pieza alguien no convocado.

## Ramas de Neon

- `dev`: desarrollo en local, desde `apps/api/.env`.
- Principal: producción, configurada en Render.
