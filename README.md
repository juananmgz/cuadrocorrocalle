# CuadroCorroCalle

Plataforma accesible desde móvil, tablet y PC para hacer organigramas de actuaciones.

## Estructura

- `apps/web`: la web (Vite, React y TypeScript).
- `apps/api`: la API (Fastify).
- `packages/shared`: código compartido entre la web y la API.

## Requisitos

- Node 22 (`nvm use 22.20.0`).
- pnpm 12 (`npm install -g pnpm`).

## Comandos

```bash
pnpm install     # instala las dependencias
pnpm dev         # web en http://localhost:5173 y API en http://localhost:3000
pnpm test        # pruebas
pnpm build       # compila la web
pnpm lint        # ESLint, Stylelint y Prettier
pnpm typecheck   # comprueba los tipos
pnpm format      # da formato al código
```
