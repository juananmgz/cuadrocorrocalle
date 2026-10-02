# Licencias

[Índice](README.md)

Decidido por Juanan el 2 de octubre de 2026. Se construye en la fase 5; hasta entonces crear grupos es libre y antes de lanzar se limpiará la base de datos.

## Modelo

- **Las licencias son del usuario**, que puede tener varias. Cada una cubre 1 grupo, N grupos (multigrupo) o grupos ilimitados (`max_groups` vacío), y puede ser temporal o para siempre.
- **Cada grupo apunta a la licencia que lo cubre** (`groups.license_id`). Una licencia no cubre más grupos que su `max_groups`.
- **Las claves de activación** (`license_keys`) las genera el administrador con su número de grupos y su duración; al canjearlas se crea una licencia del usuario que la canjea.

## Sin licencia: «Grupo de Prueba»

- Toda cuenta nueva recibe un grupo llamado «Grupo de Prueba» (ya en el paso 1.5).
- En él solo se puede montar 1 actuación con hasta 3 bailes. Para más, hay que activar una licencia.

## Migrar una licencia a otro grupo

- El grupo que pierde la licencia queda inactivo 1 mes (`inactive_since`). Si no se recupera en ese plazo, se borra con todos sus datos.
- Una licencia solo puede migrarse una vez cada 6 meses (`last_migrated_at`).

## Borrar un grupo

- Se avisa de que su licencia queda libre y se ofrecen dos opciones: crear otro grupo con ella o recibirla por correo.
- La plaza libre dura 1 mes (`reuse_until`); pasado ese tiempo se pierde.
- El borrado ya existe desde el paso 1.6; el aviso de la licencia libre y sus dos opciones se añaden en la fase 5.

## Pendiente de decidir

- Si al activar la primera licencia el «Grupo de Prueba» pasa a ser el grupo con licencia o se queda aparte.
