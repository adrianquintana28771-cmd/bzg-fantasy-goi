# BZG Fantasy Eskubaloia — Plan MVP

Propongo construir la app en **dos fases** para entregar valor rápido y evitar bloqueos. Confírmame la fase 1 y sigo.

## Fase 1 — Prototipo visual navegable (sin backend)

Objetivo: ver y validar la app completa en móvil con datos de ejemplo, generación de acta PDF real, y sistema de puntos calculado en cliente. Nada de login todavía.

### Diseño
- Identidad club: verde / blanco / rojo, moderno, deportivo, cercano, apto para familias.
- Design system en `src/styles.css` (tokens oklch, tipografía deportiva, tarjetas, badges, podio).
- Mobile-first, responsive.

### Rutas (TanStack Start)
- `/` Inicio: hero, jugador/a de la jornada, equipo destacado, últimos partidos, Top 5.
- `/rankings` con filtros (temporada, categoría, equipo, jornada, género, posición).
- `/equipos` listado por categoría + `/equipos/$teamId` ficha equipo con plantilla y ranking interno.
- `/jugadores/$playerId` ficha con stats, puntos, evolución por jornada (gráfico).
- `/partidos` listado + `/partidos/$matchId` detalle con estadísticas y estado.
- `/admin` panel (mock, sin auth aún): temporadas, equipos, jugadores, partidos, reglas de puntuación, generar/subir acta.
- `/acta/$matchId` vista imprimible A4 + botón "Descargar PDF".

### Datos de ejemplo (mock en memoria)
- 2 temporadas, 4 equipos (categorías mixtas), 20 jugadores/as ficticios (alias tipo "Ane G.", "Jon M."), 5 partidos con estadísticas y puntos calculados.
- Reglas de puntuación por defecto según tu propuesta, con "modo educativo" para benjamín/alevín.

### Motor Fantasy
- Función pura `calculateFantasyPoints(stats, rules)` configurable.
- Reglas editables desde `/admin/reglas` (persistidas en `localStorage` en fase 1).

### Acta PDF
- Generación cliente con `jspdf` + `jspdf-autotable`.
- Selección de convocados, tabla imprimible A4, QR con id de partido, firma, observaciones.

### Subida de acta
- Input de archivo (foto/PDF), preview, guardado en memoria/localStorage.
- Formulario rápido de estadísticas junto al preview.

### Privacidad
- Solo alias o nombre + inicial en vistas públicas. Sin fechas/emails/teléfonos.

## Fase 2 — Backend con Lovable Cloud (tras validar fase 1)

- Auth con roles: admin, delegado, familia/jugador, público.
- Tablas: `seasons, teams, players, matches, player_match_stats, scoring_rules` + `user_roles` (tabla separada, `has_role()` security definer).
- RLS: público lee rankings/equipos (columnas seguras); delegados escriben partidos de sus equipos; admin todo.
- Storage bucket privado `actas` para PDFs/fotos.
- Migración de mocks a Supabase.
- Preparado para futuro OCR (columna `acta_file_url`, endpoint edge listo).

## Fuera de MVP (dejar arquitectura preparada)
OCR automático, notificaciones, euskera/castellano toggle, exportación Excel, comparativas, trofeos.

## Detalles técnicos
- Stack ya existente: TanStack Start + React 19 + Tailwind v4 + shadcn.
- Nuevas deps: `jspdf`, `jspdf-autotable`, `qrcode`, `recharts` (evolución puntos).
- Todo con tokens de diseño semánticos, sin colores hardcoded en componentes.

---

**Preguntas antes de construir:**
1. ¿Empezamos por **Fase 1** (prototipo visual con mocks, ~1 iteración) y luego Cloud? ¿O prefieres arrancar ya con Cloud + auth desde el principio?
2. ¿Tienes **logo del club** o lo genero provisional?
3. ¿Idioma de la UI en esta primera versión: **castellano**, euskera, o ambos con toggle?