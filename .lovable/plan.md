# Plan: Plantilla, sobres, misiones y alineación

Nota: al describir los huecos salieron 7 posiciones (portero + 2 extremos + 2 laterales + central + pivote), no 5. El plan asume **7 huecos reales de balonmano**. Dime si prefieres reducirlo.

## Alcance
1. Nueva ruta `/plantilla` (protegida) con dos zonas: **Mis jugadores** y **Pista (alineación)**.
2. Sistema de **sobres** ganados completando **misiones**.
3. Alineación **por jornada** con límite de **5 usos por jugador en toda la temporada**.
4. Panel admin (super_admin/manager) para crear misiones y abrir jornadas.

## UX

### Ruta `/plantilla`
```
+-----------------------------------------+
|  Jornada activa: J5   ·  Sobres: 2 [Abrir] |
+----------------------+------------------+
|  MIS JUGADORES       |  PISTA           |
|  (lista con usos     |    [EI]  [C]  [ED]|
|   restantes 5/5)     |    [LI] [P] [LD] |
|  drag → hueco        |         [PT]     |
|                      |  Guardar alineac.|
+----------------------+------------------+
|  Misiones activas  [Completar]           |
+-----------------------------------------+
```
- Cada jugador muestra `usos_restantes`. Al llegar a 0 no se puede alinear.
- Al **Guardar alineación** se bloquea al inicio de la jornada (fecha configurable por admin).
- Solo los jugadores alineados suman puntos en esa jornada.

### Sobres
- Botón "Abrir sobre" → animación simple → 3 jugadores aleatorios del pool disponible (respetando categoría/género si aplica; por defecto todos). Se añaden a la plantilla del usuario.

### Misiones
- Ejemplos: "Inicia sesión 3 días seguidos", "Predice el resultado de un partido", "Alinea 7 jugadores en una jornada".
- Al cumplirse, el usuario reclama la recompensa (nº de sobres).
- MVP: misiones marcadas manualmente como completadas por el usuario (`self-report`) + una automática ("primera alineación guardada"). Ampliaciones futuras.

## Modelo de datos (Lovable Cloud)

- `jornadas` (numero, nombre, lineup_locks_at, is_active)
- `player_pool` (id, nombre, posicion enum, categoria, genero, rating)
- `user_players` (user_id, player_id, obtenido_at) — inventario del usuario, único (user_id, player_id)
- `player_usage` (user_id, player_id, usos_gastados int default 0) — se incrementa al validarse la jornada
- `lineups` (user_id, jornada_id, portero, ext_izq, ext_der, lat_izq, lat_der, central, pivote, locked_at) — únicos por (user_id, jornada_id)
- `sobres` (id, user_id, source enum('mision','admin'), opened_at nullable)
- `misiones` (id, nombre, descripcion, recompensa_sobres, tipo enum('self','auto'), is_active)
- `user_misiones` (user_id, mision_id, completed_at, claimed_at) — único por (user_id, mision_id)

Enum `posicion`: `portero | extremo_izq | extremo_der | lateral_izq | lateral_der | central | pivote`.

Cada hueco de la pista solo acepta jugadores cuya `posicion` coincida (portero solo portero; el resto por su posición natural).

RLS:
- `user_players`, `player_usage`, `lineups`, `sobres`, `user_misiones`: usuario ve/edita solo lo suyo; admins/managers ven todo.
- `player_pool`, `misiones`, `jornadas`: lectura pública autenticada; escritura solo staff.

## Server functions
- `openSobre()` → escoge N jugadores random no repetidos, los inserta en `user_players`, marca `opened_at`.
- `saveLineup({ jornadaId, slots })` → valida posiciones, usos restantes > 0, jornada no bloqueada; upsert.
- `lockJornada(jornadaId)` (staff) → incrementa `usos_gastados` de todos los alineados y bloquea.
- `completeMision(misionId)` (self) → crea `user_misiones` completado; `claimReward()` → genera sobres.

## Admin (`/admin/plantilla`)
- Crear jornadas, marcar activa, botón "Cerrar jornada" (aplica usos).
- Crear/editar misiones y su recompensa.
- Otorgar sobres manualmente a un usuario.
- Ver plantillas y alineaciones de usuarios (solo staff).

## UI
- Componente `HandballCourt` con SVG de media pista y 7 slots posicionados.
- Drag&drop con `@dnd-kit/core`.
- Reutiliza tokens de diseño existentes (nada de colores hardcoded).

## Fuera de alcance (siguiente iteración)
- Puntuación real vinculada a estadísticas de partidos (hoy los stats están en mock; cuando migren a DB, conectar `lineups` × `match_stats` para calcular la puntuación del usuario por jornada).
- Mercado entre usuarios / trades.
- Animaciones avanzadas de apertura de sobre.

¿Confirmas huecos = 7 y avanzo con la migración + UI?