# Documentación de CuadroCorroCalle

Documentación técnica de la herramienta. Se actualiza con cada commit. Las ideas, el plan y los casos de uso siguen en Notion.

> El repositorio es público, así que estas páginas también lo son. No escribas aquí contraseñas, cadenas de conexión ni datos personales.

## Estado

- `main` publica la v0.3.5 (fases 0 a 2 y los pasos 3.1 y 3.2 de la fase 3). En `devel` sigue la fase 3; la revisión de accesibilidad pasó al paso 5.4.
- Web: <https://cuadrocorrocalle.pages.dev>
- API: <https://cuadrocorrocalle-api.onrender.com>

## Páginas

- [Versiones](changelog.md): qué commits y PR entran en cada versión.
- [Arquitectura](architecture.md): piezas de la herramienta y cómo se comunican.
- [Repositorio](repository.md): monorepo, herramientas, comandos y ramas.
- [Base de datos](database.md): esquema y migraciones.
- [Publicación](deployment.md): Neon, Render y Cloudflare Pages.
- [Analítica y cookies](analytics.md): Google Analytics 4 con consentimiento.
- [Seguridad de las cuentas](security.md): contraseñas, sesiones y límites de intentos.
- [Alta guiada](onboarding.md): las tres preguntas de una cuenta nueva.
- [Mi cuenta](account.md): nombre, correo, contraseña y borrar la cuenta.
- [Estado y administración](status.md): `/status` y `/componentes`, solo para administradores.
- [Grupos](groups.md): elegir y crear grupo, color de cuadrícula.
- [Personas](people.md): «Mi grupo», añadir, pegar una lista y editar personas.
- [Actuaciones](performances.md): crear, editar, duplicar y borrar actuaciones.
- [Licencias](licensing.md): licencias por usuario, grupo de prueba, migrar y borrar.

## Cómo se escribe

- Una página Markdown por tema, enlazada desde este índice.
- Diagramas en bloques `mermaid`, que GitHub y la mayoría de visores dibujan.
- Si un cambio de código altera algo de lo que se cuenta aquí, la página se actualiza en el mismo commit.
