# Versiones

[Índice](README.md)

Qué commits entran en cada versión, con enlace a su pull request. Cada fase del plan cerrada sube el número del medio (fase 1 → v0.2.0); los ajustes de una fase ya publicada son parches; la versión final será la v1.0.0.

## Nomenclatura

- **Pull requests:** `CCC-XXXX / nombre`, donde `XXXX` es el número de la PR en GitHub con cuatro cifras. En la descripción va primero la versión a la que pertenece y después un resumen en viñetas.
- **Commits:** emoji de gitmoji y texto breve en inglés, por ejemplo `✨ Add cookie consent banner`.
- **Releases** (`devel` → `main`): `Release vX.Y.Z: resumen`.

Las PR anteriores a la #13 llevaban el número de paso del plan en el título.

## v0.3.0 (en curso: fase 2)

| PR                                                                | Commit                                                                    | Cambio                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| [CCC-0036](https://github.com/juananmgz/cuadrocorrocalle/pull/36) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/36/commits) | ✨ Place people on the stage by dragging them (paso 2.1)  |
| [CCC-0037](https://github.com/juananmgz/cuadrocorrocalle/pull/37) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/37/commits) | 💄 Open performances on a summary and save edits live     |
| [CCC-0038](https://github.com/juananmgz/cuadrocorrocalle/pull/38) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/38/commits) | ✨ Place simple figures on the stage (paso 2.2)           |
| [CCC-0039](https://github.com/juananmgz/cuadrocorrocalle/pull/39) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/39/commits) | ✨ Rows and rings of holes filled with figures (paso 2.3) |
| [CCC-0040](https://github.com/juananmgz/cuadrocorrocalle/pull/40) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/40/commits) | ✨ Free dance and spaces of any figure (paso 2.4)         |
| [CCC-0041](https://github.com/juananmgz/cuadrocorrocalle/pull/41) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/41/commits) | ✨ Diagonal trios and rows, and a tidier tray (paso 2.4)  |
| [CCC-0042](https://github.com/juananmgz/cuadrocorrocalle/pull/42) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/42/commits) | ✨ Figure menu: mirror, duplicate and delete (paso 2.5)   |
| [CCC-0043](https://github.com/juananmgz/cuadrocorrocalle/pull/43) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/43/commits) | ✨ The cross and a folding tray (paso 2.5)                |

## v0.2.1 (en curso)

| PR                                                                | Commit                                                                    | Cambio                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [CCC-0035](https://github.com/juananmgz/cuadrocorrocalle/pull/35) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/35/commits) | 🐛 Generate the Prisma client explicitly in the Render build |

## v0.2.0 · [Release #33](https://github.com/juananmgz/cuadrocorrocalle/pull/33)

| PR                                                                | Commit                                                                    | Cambio                                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [CCC-0013](https://github.com/juananmgz/cuadrocorrocalle/pull/13) | [72814e8](https://github.com/juananmgz/cuadrocorrocalle/commit/72814e8)   | ✨ Add cookie consent banner and GA4 behind consent (paso 1.1)                              |
| [CCC-0014](https://github.com/juananmgz/cuadrocorrocalle/pull/14) | [bcd74b8](https://github.com/juananmgz/cuadrocorrocalle/commit/bcd74b8)   | ✨ Add email and password accounts with Better Auth (paso 1.2)                              |
| [CCC-0015](https://github.com/juananmgz/cuadrocorrocalle/pull/15) | [c1ceacb](https://github.com/juananmgz/cuadrocorrocalle/commit/c1ceacb)   | 🔒️ Lock the API to the web proxy and add a Content Security Policy (paso 1.2)               |
| [CCC-0016](https://github.com/juananmgz/cuadrocorrocalle/pull/16) | [4bac534](https://github.com/juananmgz/cuadrocorrocalle/commit/4bac534)   | ✨ Add email confirmation and password reset with Brevo (paso 1.3)                          |
| [CCC-0017](https://github.com/juananmgz/cuadrocorrocalle/pull/17) | [c37485f](https://github.com/juananmgz/cuadrocorrocalle/commit/c37485f)   | ✨ Add Google sign-in (paso 1.4)                                                            |
| [CCC-0018](https://github.com/juananmgz/cuadrocorrocalle/pull/18) | [db22032](https://github.com/juananmgz/cuadrocorrocalle/commit/db22032)   | ✨ Add groups with chooser dialog and grid colours (paso 1.5)                               |
| [CCC-0019](https://github.com/juananmgz/cuadrocorrocalle/pull/19) | [a1a996d](https://github.com/juananmgz/cuadrocorrocalle/commit/a1a996d)   | ✨ Add group deletion with confirmation (paso 1.6)                                          |
| [CCC-0019](https://github.com/juananmgz/cuadrocorrocalle/pull/19) | [4d1c8c2](https://github.com/juananmgz/cuadrocorrocalle/commit/4d1c8c2)   | 💄 Show the full name as logo and a side menu on phones                                     |
| [CCC-0020](https://github.com/juananmgz/cuadrocorrocalle/pull/20) | [0192acb](https://github.com/juananmgz/cuadrocorrocalle/commit/0192acb)   | ✨ Add people to groups with a pasted list and the Mi grupo page (paso 1.7)                 |
| [CCC-0021](https://github.com/juananmgz/cuadrocorrocalle/pull/21) | [1f76d9f](https://github.com/juananmgz/cuadrocorrocalle/commit/1f76d9f)   | ✨ Add performances with create, edit, duplicate and delete (paso 1.8)                      |
| [CCC-0022](https://github.com/juananmgz/cuadrocorrocalle/pull/22) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/22/commits) | ✨ Create performances from home with a stage preview seen from above                       |
| [CCC-0022](https://github.com/juananmgz/cuadrocorrocalle/pull/22) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/22/commits) | 💫 Move the grid camera with a dolly zoom and show the stage once it settles                |
| [CCC-0022](https://github.com/juananmgz/cuadrocorrocalle/pull/22) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/22/commits) | 🔥 Remove the performances page and the create dialog                                       |
| [CCC-0022](https://github.com/juananmgz/cuadrocorrocalle/pull/22) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/22/commits) | 💄 Show the stage section title under its divider                                           |
| [CCC-0023](https://github.com/juananmgz/cuadrocorrocalle/pull/23) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/23/commits) | 🐛 Resize the stage from its centre, add the stage border and filter form input             |
| [CCC-0024](https://github.com/juananmgz/cuadrocorrocalle/pull/24) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/24/commits) | ✨ Add the call-up step and people roles, filters and bulk actions (paso 1.9)               |
| [CCC-0024](https://github.com/juananmgz/cuadrocorrocalle/pull/24) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/24/commits) | 💄 Keep the Mi grupo cards in view and scroll only their content                            |
| [CCC-0024](https://github.com/juananmgz/cuadrocorrocalle/pull/24) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/24/commits) | 💚 Stop the account lookup from failing web tests in CI                                     |
| [CCC-0025](https://github.com/juananmgz/cuadrocorrocalle/pull/25) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/25/commits) | 💄 Choose the call-up with person chips, filters and an import dialog                       |
| [CCC-0026](https://github.com/juananmgz/cuadrocorrocalle/pull/26) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/26/commits) | 🐛 Keep a margin above large stages and cap the stage size                                  |
| [CCC-0027](https://github.com/juananmgz/cuadrocorrocalle/pull/27) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/27/commits) | ✨ Add the repertoire with ordered pieces, drag to reorder and a stage block (paso 1.10)    |
| [CCC-0027](https://github.com/juananmgz/cuadrocorrocalle/pull/27) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/27/commits) | 💄 Polish the create form: editable title, required marks, Enter and cancel dialog          |
| [CCC-0028](https://github.com/juananmgz/cuadrocorrocalle/pull/28) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/28/commits) | ✨ Choose who takes part in each piece and edit performances like creating them (paso 1.11) |
| [CCC-0029](https://github.com/juananmgz/cuadrocorrocalle/pull/29) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/29/commits) | ✨ Add the repertoire summary and an encore list (paso 1.12)                                |
| [CCC-0030](https://github.com/juananmgz/cuadrocorrocalle/pull/30) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/30/commits) | ✨ Add the guided start for new accounts (paso 1.13)                                        |
| [CCC-0031](https://github.com/juananmgz/cuadrocorrocalle/pull/31) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/31/commits) | ✨ Let users change their name, email and password and delete their account (paso 1.14)     |
| [CCC-0031](https://github.com/juananmgz/cuadrocorrocalle/pull/31) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/31/commits) | 🐛 Offer to retry instead of signing out when the API does not answer                       |
| [CCC-0032](https://github.com/juananmgz/cuadrocorrocalle/pull/32) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/32/commits) | ✨ Move the welcome page to an admin-only status page                                       |
| [CCC-0032](https://github.com/juananmgz/cuadrocorrocalle/pull/32) | [en la PR](https://github.com/juananmgz/cuadrocorrocalle/pull/32/commits) | 💄 Point at the missing fields with a yellow heartbeat                                      |

## v0.1.1 · [Release #12](https://github.com/juananmgz/cuadrocorrocalle/pull/12)

| PR                                                           | Commit                                                                  | Cambio                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [#10](https://github.com/juananmgz/cuadrocorrocalle/pull/10) | [a457616](https://github.com/juananmgz/cuadrocorrocalle/commit/a457616) | 📝 Move technical documentation into the repo (paso 0.8)                                    |
| [#11](https://github.com/juananmgz/cuadrocorrocalle/pull/11) | [b210daf](https://github.com/juananmgz/cuadrocorrocalle/commit/b210daf) | 💄 Add theme switch, tinted toasts, active tab, 20 person colors and curved grid (paso 0.8) |

## v0.1.0 · [Release #9](https://github.com/juananmgz/cuadrocorrocalle/pull/9)

Fase 0 completa (pasos 0.1 a 0.7), publicada en `main` con las PR [#4](https://github.com/juananmgz/cuadrocorrocalle/pull/4), [#7](https://github.com/juananmgz/cuadrocorrocalle/pull/7) y [#9](https://github.com/juananmgz/cuadrocorrocalle/pull/9).

| PR                                                         | Commit                                                                  | Cambio                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [#1](https://github.com/juananmgz/cuadrocorrocalle/pull/1) | [257631a](https://github.com/juananmgz/cuadrocorrocalle/commit/257631a) | 🎉 Set up pnpm monorepo with linting (paso 0.1)                   |
| [#2](https://github.com/juananmgz/cuadrocorrocalle/pull/2) | [a25846a](https://github.com/juananmgz/cuadrocorrocalle/commit/a25846a) | ✨ Add web app with Tiza welcome page (paso 0.2)                  |
| Sin PR                                                     | [4560dd2](https://github.com/juananmgz/cuadrocorrocalle/commit/4560dd2) | ✨ Add Fastify API health route and web API status (paso 0.3)     |
| [#3](https://github.com/juananmgz/cuadrocorrocalle/pull/3) | [bb5e64d](https://github.com/juananmgz/cuadrocorrocalle/commit/bb5e64d) | 🗃️ Add Prisma with Neon database and health check (paso 0.4)      |
| [#5](https://github.com/juananmgz/cuadrocorrocalle/pull/5) | [4f419c3](https://github.com/juananmgz/cuadrocorrocalle/commit/4f419c3) | 👷 Add CI workflow for lint, types, tests and build (paso 0.5)    |
| Directo a `main`                                           | [b49402b](https://github.com/juananmgz/cuadrocorrocalle/commit/b49402b) | 👷 Allow only devel to merge into main (paso 0.5)                 |
| [#6](https://github.com/juananmgz/cuadrocorrocalle/pull/6) | [09c5479](https://github.com/juananmgz/cuadrocorrocalle/commit/09c5479) | 🚀 Add Render blueprint and Cloudflare Pages API proxy (paso 0.6) |
| [#8](https://github.com/juananmgz/cuadrocorrocalle/pull/8) | [4066ea0](https://github.com/juananmgz/cuadrocorrocalle/commit/4066ea0) | 💄 Add Radix-based UI components and showcase page (paso 0.7)     |
