# Repositorio

[Índice](README.md)

Monorepo con pnpm 12 y Node 22 (22.13 o superior).

```mermaid
flowchart TD
  R["cuadrocorrocalle (monorepo pnpm 12, Node 22)"]
  R --> AW["apps/web"]
  R --> AA["apps/api"]
  R --> PS["packages/shared"]
  R --> DOC["documentation: esta documentación"]
  AW -->|"workspace:*"| PS
  AA -->|"workspace:*"| PS
  R --> T["Herramientas en la raíz"]
  T --> TS["TypeScript 6 (tsconfig.base.json)"]
  T --> ES["ESLint 10 (eslint.config.js)"]
  T --> ST["Stylelint 17 + SCSS (.stylelintrc.json)"]
  T --> PR["Prettier 3 (.prettierrc.json)"]
  AW --> V["Vite 8 + SCSS Modules (sass-embedded)"]
  AW --> VT["Vitest + Testing Library (jsdom)"]
  AW --> FS["src: components/, pages/, styles/ (_tokens, _mixins, global)"]
  AW --> TQ["TanStack Query; proxy de Vite /api a localhost:3000"]
  AW --> UI["components/ui: componentes sobre Radix (radix-ui), cada uno con su SCSS<br>Button, TextField, Select, Dialog, Menu, Tabs, Toast, Card, PersonChip, ColorPicker"]
  AW --> TB["components/TopBar y página /componentes (carga diferida)"]
  AW --> PF["functions/api/[[path]].ts: proxy /api en Cloudflare Pages"]
  AA --> FA["Fastify con tsx; src/app.ts, src/server.ts, src/modules/health"]
  AA --> VA["Vitest con app.inject"]
  AA --> PRI["Prisma 7: prisma/schema.prisma, prisma/migrations, prisma.config.ts<br>cliente generado en src/generated (fuera de git)"]
  AA --> ENV[".env local con DATABASE_URL y DIRECT_URL (fuera de git); .env.example de plantilla"]
  R --> RY["render.yaml: API en Render (Frankfurt), migraciones al publicar"]
  PS --> Z["Zod 4"]
```

## Puesta en marcha

1. Node 22.13 o superior y pnpm 12.8.1 (`npm i -g pnpm@12.8.1`).
2. `pnpm install`.
3. Copia `apps/api/.env.example` a `apps/api/.env` y pon la cadena de conexión de la rama `dev` de Neon. La web funciona sin ella.

## Comandos

```bash
pnpm install     # instala las dependencias
pnpm dev         # web en http://localhost:5173 y API en http://localhost:3000
pnpm test        # pruebas
pnpm build       # compila
pnpm lint        # ESLint, Stylelint y Prettier
pnpm typecheck   # comprueba los tipos
pnpm format      # da formato al código
```

## Ramas y protección

- `feat/<nombre>` para funciones nuevas y `fix/<nombre>` para arreglos, con PR hacia `devel`.
- `devel` se fusiona en `main` al terminar un paso completo del plan.
- Commits y títulos de PR en inglés con gitmoji y el número de paso delante: `0.7 💄 Add Radix-based UI components`.

```mermaid
flowchart LR
  F["feat/&lt;name&gt; y fix/&lt;name&gt;"] -->|"PR"| D["devel<br>integración"]
  D -->|"PR al cerrar un paso"| M["main<br>lo que se publica"]
  CI["Workflow ci, job checks<br>lint, tipos, pruebas y build"] -.->|"en cada PR y push"| D
  CI -.-> M
  W["Workflow main-from-devel<br>job source-branch"] -.->|"falla si el PR a main no viene de devel"| M
  R["Ruleset de main (activo)<br>PR obligatorio, check source-branch,<br>sin force push ni borrado"] -.-> M
```
