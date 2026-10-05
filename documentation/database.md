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
- `20261002175748_stage_edge_distance`, `20261003094303_default_half_metre_square` y `20261003094432_default_quarter_metre_edge` (paso 1.8.1): borde del escenario, cuadrado de 0,5 m y borde de 0,25 m por defecto.
- `20261003100841_call_ups` (paso 1.9): tipo de persona (miembro o colaborador) y convocatoria de cada actuación.
- `20261003123935_person_roles`: roles de cada persona (baile, música, canto…).
- `20261004093000_pieces` (paso 1.10): repertorio de cada actuación, en orden.
- `20261004193000_participations` (paso 1.11): quién sale en cada pieza y qué hace.
- `20261004210000_piece_encore` (paso 1.12): piezas de bis, aparte del repertorio.
- `20261005090000_user_admin`: marca de administrador de la plataforma (`isAdmin`).
- `20261005100000_participation_position` (paso 2.1): dónde está cada persona en cada pieza (`x_m`, `y_m`).
- `20261005150000_figures` (paso 2.2): figuras de cada pieza, a qué figura y hueco pertenece cada participación y la configuración de figuras de cada grupo (`figure_defaults`).
- `20261005220000_spaces` (paso 2.3): espacios (fila y corro) como figuras; cada figura simple puede ir en el hueco de un espacio (`space_id`, `hole`), con su disposición (`arrangement`) y un giro libre dentro de un corro (`angle`).
- `20261005230000_space_gap` (paso 2.3): separación entre los huecos de un espacio, en metros (`gap_m`; 0,5 por defecto).

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
    boolean isAdmin "solo a mano"
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
    jsonb figure_defaults "giro y ancho de cada figura"
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
    text membership "member o collaborator"
    text_array roles "dance, music, singing…"
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
  people ||--o{ call_ups : "convocada en"
  performances ||--o{ call_ups : "convoca"
  call_ups {
    text performance_id PK,FK
    text person_id PK,FK
    text status "yes, no o maybe"
  }
  performances ||--o{ pieces : "repertorio"
  pieces {
    text id PK
    text performance_id FK
    int position "orden, desde 0"
    text title
    text type "dance, song o recorded"
    int duration_s
    text structure
    boolean optional
    boolean encore "bis"
  }
  pieces ||--o{ participations : "quién sale"
  call_ups ||--o{ participations : "solo convocados"
  participations {
    text piece_id PK,FK
    text person_id PK,FK
    text performance_id FK
    text_array roles "dance, music, singing"
    float x_m "null sin colocar"
    float y_m "null sin colocar"
    text figure_id FK "null si va suelta"
    int slot "hueco en la figura"
  }
  pieces ||--o{ figures : "en su escenario"
  figures ||--o{ participations : "sus miembros"
  figures ||--o{ figures : "sus huecos (espacios)"
  figures {
    text id PK "lo genera la web"
    text piece_id FK
    text kind "solo, pair, pair_diagonal, trio_line, trio_triangle, square, diamond, row, ring"
    float x_m "centro"
    float y_m "centro"
    int rotation "0, 90, 180, 270"
    float width "casillas, de media en media; en espacios, huecos"
    text arrangement "espacios: series o battery"
    float gap_m "espacios: separación entre huecos"
    text space_id "figura simple dentro de un espacio"
    int hole "su hueco en el espacio"
    float angle "giro libre en un corro, en grados"
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
    boolean isAdmin "administrador"
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
    text type "baile, canción, grabación"
    int duration_s
    text structure
    boolean optional
    text audience_side "si cambia"
    text music_side "si cambia"
  }
  participations {
    text piece_id PK,FK
    text person_id PK,FK
    text performance_id FK
    text_array roles "baila, toca, canta"
    float x_m "persona suelta"
    float y_m "persona suelta"
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
