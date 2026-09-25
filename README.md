# BZG Points Tracker

## Contexto / Rol

Actúa como un equipo experto en diseño de producto, desarrollo web no-code/low-code, UX/UI deportiva y bases de datos para clubes deportivos.

Quiero crear una app/web estilo Fantasy inspirada en el Fantasy de fútbol, pero adaptada a un club de balonmano base: *Berdezurigorri / BZG Etxebarri*, un club de balonmano mixto de Etxebarri con equipos masculinos y femeninos, desde categorías pequeñas como benjamín hasta senior.

La app debe tener un enfoque divertido, visual y motivador, pero también educativo y adecuado para menores. No debe parecer una app de apuestas ni fomentar competitividad negativa. La idea es que jugadores/as, familias, entrenadores/as y delegados/as puedan ver la evolución de los puntos Fantasy de cada jugador/a según sus estadísticas en los partidos.

El estilo visual debe inspirarse en la identidad del club: *verde, blanco y rojo*, con un diseño moderno, deportivo, limpio y muy fácil de usar desde móvil.

---

## Consulta / Tarea

Crea una aplicación web responsive llamada provisionalmente *BZG Fantasy Eskubaloia*.

La app debe permitir:

1. Gestionar temporadas, equipos, categorías y jugadores/as.

2. Registrar partidos de cada equipo.

3. Introducir estadísticas individuales de cada jugador/a.

4. Convertir esas estadísticas en puntos Fantasy mediante un sistema configurable.

5. Mostrar rankings por jugador/a, equipo, categoría, jornada y temporada.

6. Generar un acta/hoja de partido imprimible para que el delegado/a pueda anotar estadísticas durante el partido.

7. Permitir subir posteriormente el acta o informe del partido para facilitar la carga de datos.

8. Tener panel de administración para modificar criterios de puntuación sin tocar código.

---

## Especificaciones funcionales

### 1. Tipos de usuario

La app debe tener varios roles:

*Administrador/a del club*

* Puede crear temporadas.

* Puede crear equipos.

* Puede crear categorías.

* Puede añadir, editar o eliminar jugadores/as.

* Puede configurar el sistema de puntuación.

* Puede validar partidos y estadísticas.

* Puede ver todos los rankings.

*Entrenador/a o delegado/a*

* Puede crear partidos de sus equipos.

* Puede descargar/imprimir el acta del partido.

* Puede introducir estadísticas después del partido.

* Puede subir foto/PDF del acta.

* Puede revisar el cálculo de puntos antes de publicar.

*Jugador/a o familia*

* Puede ver rankings públicos.

* Puede consultar ficha básica del jugador/a.

* Puede ver estadísticas y puntos acumulados.

* No puede editar datos.

*Visitante público*

* Puede ver ranking general, rankings por equipo y resumen de jornadas.

* No debe ver datos personales sensibles de menores.

---

### 2. Estructura principal de la app

Crear las siguientes páginas:

#### Página de inicio

* Logo/nombre: *BZG Fantasy Eskubaloia*

* Frase principal: “El Fantasy del balonmano de Etxebarri”

* Botones:

  * Ver rankings

  * Ver equipos

  * Acceso delegado/a

  * Acceso administración

* Resumen visual:

  * Jugador/a de la jornada

  * Equipo destacado

  * Últimos partidos registrados

  * Top 5 Fantasy de la temporada

#### Página de equipos

* Listado de equipos por categoría:

  * Benjamín

  * Alevín

  * Infantil

  * Cadete

  * Juvenil

  * Senior

* Cada equipo debe poder marcarse como masculino, femenino o mixto.

* Cada equipo tendrá:

  * Nombre

  * Categoría

  * Temporada

  * Foto opcional

  * Plantilla de jugadores/as

  * Ranking interno

#### Página de jugador/a

Cada ficha de jugador/a debe mostrar:

* Nombre público o alias

* Equipo

* Categoría

* Posición: portero/a, extremo, lateral, central, pivote, universal

* Partidos jugados

* Goles

* Asistencias

* Recuperaciones

* Paradas, si es portero/a

* Exclusiones

* Pérdidas

* Puntos Fantasy totales

* Media de puntos por partido

* Evolución por jornadas

Importante: como puede haber menores, permitir mostrar solo nombre + inicial del apellido o alias.

#### Página de partidos

Cada partido debe incluir:

* Temporada

* Jornada

* Fecha

* Equipo BZG

* Rival

* Local/visitante

* Resultado

* Categoría

* Estado: pendiente, estadísticas introducidas, validado, publicado

* Acta descargable

* Acta subida

* Estadísticas por jugador/a

* Puntos calculados

#### Página de rankings

Crear rankings filtrables por:

* Temporada

* Categoría

* Equipo

* Jornada

* Masculino/femenino/mixto

* Posición

* General del club

Mostrar:

* Ranking total

* Ranking por media de puntos

* Mejor jugador/a de la jornada

* Mejor portero/a

* Jugador/a más regular

* Equipo con más puntos

* Top progresión

---

### 3. Sistema de puntuación Fantasy

Los criterios definitivos todavía no están decididos, así que el sistema debe ser completamente configurable desde el panel de administración.

Crear una tabla o módulo llamado *Reglas de puntuación* donde el administrador pueda modificar los puntos de cada acción.

Propuesta inicial de puntuación:

#### Acciones positivas generales

* Gol: +3 puntos

* Asistencia: +2 puntos

* Recuperación de balón: +2 puntos

* Bloqueo defensivo: +2 puntos

* Provocar 7 metros: +2 puntos

* Provocar exclusión rival: +2 puntos

* Partido jugado: +2 puntos

* Victoria del equipo: +3 puntos

* Empate: +1 punto

#### Acciones de portero/a

* Parada: +1 punto

* Parada de 7 metros: +4 puntos

* Menos de 20 goles encajados: +3 puntos

* Portería imbatida en un tramo relevante: +2 puntos opcional

#### Acciones negativas

* Pérdida de balón: -1 punto

* Lanzamiento de 7 metros fallado: -2 puntos

* Exclusión de 2 minutos: -2 puntos

* Tarjeta roja: -5 puntos

#### Bonificaciones

* MVP del partido: +5 puntos

* Mejor defensor/a: +3 puntos

* Mejor actitud/esfuerzo: +3 puntos

* Debut en partido oficial: +2 puntos

Para categorías pequeñas como benjamín o alevín, incluir opción de “modo educativo”, donde las acciones negativas no resten o resten menos. El objetivo es motivar, no castigar.

---

### 4. Generador de acta imprimible

La app debe generar automáticamente una hoja de partido descargable en PDF.

El delegado/a debe poder seleccionar:

* Temporada

* Equipo

* Rival

* Fecha

* Jornada

* Categoría

* Jugadores/as convocados

Al generar el acta, debe aparecer una tabla imprimible con:

Columnas:

* Dorsal

* Nombre jugador/a

* Goles

* Asistencias

* Recuperaciones

* Bloqueos

* Pérdidas

* 7m provocados

* 7m fallados

* Exclusiones

* Paradas, si es portero/a

* Paradas 7m, si es portero/a

* MVP

* Observaciones

El acta debe incluir:

* Nombre del partido

* Equipo

* Rival

* Fecha

* Código QR o identificador único del partido

* Espacio para firma del delegado/a

* Espacio para observaciones

Diseñar el acta para que sea fácil de imprimir en A4.

---

### 5. Subida de actas e importación de datos

La app debe permitir subir:

* Foto del acta

* PDF del acta

* Imagen escaneada

* CSV/Excel manual

Flujo ideal:

1. El delegado/a descarga el acta antes del partido.

2. Durante el partido apunta estadísticas a mano.

3. Después del partido sube una foto o PDF del acta.

4. La app guarda el archivo asociado al partido.

5. En la primera versión, permitir introducir los datos manualmente viendo el acta subida como referencia.

6. En una versión avanzada, preparar la estructura para OCR o lectura automática del acta.

Para simplificar el MVP, priorizar:

* Subida del archivo.

* Vista previa del acta.

* Formulario rápido para introducir estadísticas.

* Cálculo automático de puntos.

Dejar preparada la arquitectura para que en el futuro se pueda añadir OCR.

---

### 6. Panel de administración

Crear un panel privado con:

#### Gestión de temporadas

* Crear temporada

* Activar temporada actual

* Cerrar temporada

#### Gestión de equipos

* Crear equipo

* Editar equipo

* Asignar categoría

* Asignar género: masculino, femenino, mixto

* Asignar jugadores/as

#### Gestión de jugadores/as

* Crear jugador/a

* Editar jugador/a

* Activar/desactivar jugador/a

* Asignar dorsal

* Asignar posición

* Definir nombre público o alias

#### Gestión de partidos

* Crear partido

* Generar acta

* Subir acta

* Introducir estadísticas

* Validar estadísticas

* Publicar puntos

#### Gestión de puntuaciones

* Editar puntos por acción

* Crear reglas diferentes por categoría

* Activar/desactivar acciones negativas

* Activar modo educativo para categorías base

* Guardar historial de cambios

---

### 7. Base de datos sugerida

Crear una estructura de datos con estas tablas:

*users*

* id

* name

* email

* role

* created_at

*seasons*

* id

* name

* start_date

* end_date

* is_active

*teams*

* id

* season_id

* name

* category

* gender_type

* image_url

*players*

* id

* team_id

* public_name

* full_name_private

* dorsal

* position

* is_minor

* active

*matches*

* id

* season_id

* team_id

* opponent

* date

* round

* location_type

* goals_for

* goals_against

* status

* match_code

* acta_file_url

*player_match_stats*

* id

* match_id

* player_id

* played

* goals

* assists

* steals

* blocks

* turnovers

* seven_meters_won

* seven_meters_missed

* two_min_exclusions

* red_card

* saves

* seven_meter_saves

* mvp

* attitude_bonus

* fantasy_points

*scoring_rules*

* id

* season_id

* category

* stat_key

* points_value

* active

* educational_mode

---

### 8. Diseño UX/UI

Diseñar una interfaz:

* Moderna

* Deportiva

* Muy visual

* Optimizada para móvil

* Fácil de usar por delegados/as durante la temporada

* Con colores verde, blanco y rojo

* Con tarjetas de jugador/a

* Con rankings tipo Fantasy

* Con insignias y medallas visuales

Componentes visuales:

* Cards de jugador/a

* Tabla de ranking

* Filtros superiores

* Botón claro de “Generar acta”

* Botón claro de “Subir acta”

* Estado del partido con etiquetas de color

* Podio top 3

* Evolución de puntos por jornada

Evitar una estética demasiado seria. Debe sentirse como una herramienta de club, familiar, divertida y cercana.

---

### 9. Privacidad y menores

Como la app puede incluir menores, cuidar mucho la privacidad.

Requisitos:

* No mostrar datos personales sensibles.

* Permitir usar alias o nombre + inicial.

* No mostrar fechas de nacimiento públicamente.

* No mostrar emails ni teléfonos.

* Separar datos privados y públicos.

* Solo administradores pueden ver nombre completo si se necesita.

* Añadir aviso de privacidad básico.

* Preparar la app para que el club pueda gestionar consentimientos de imagen/datos en el futuro.

---

### 10. MVP prioritario

Primera versión mínima viable:

1. Login por roles.

2. Crear temporada.

3. Crear equipos.

4. Crear jugadores/as.

5. Crear partidos.

6. Generar acta imprimible en PDF.

7. Subir acta del partido.

8. Introducir estadísticas manualmente.

9. Calcular puntos Fantasy automáticamente.

10. Ver rankings por equipo y categoría.

No priorizar todavía:

* OCR automático perfecto.

* Notificaciones push.

* App nativa.

* Integración con federaciones.

* Estadísticas avanzadas complejas.

---

### 11. Funcionalidades futuras

Preparar la arquitectura para añadir más adelante:

* OCR para leer actas automáticamente.

* Importación desde Excel.

* Notificaciones a familias.

* Trofeos virtuales.

* Retos semanales.

* Ranking histórico por temporadas.

* Comparativas jugador/a vs media del equipo.

* Modo entrenador con análisis de rendimiento.

* Web pública del club integrada.

* Idioma euskera/castellano.

* Exportación de datos a Excel.

* Panel para campus o torneos especiales.

---

## Criterios de calidad

La app debe cumplir:

1. Debe ser sencilla de usar para personas no técnicas.

2. Debe funcionar bien desde móvil.

3. Debe evitar complejidad innecesaria en la primera versión.

4. Debe separar claramente parte pública y parte privada.

5. Debe permitir modificar los puntos Fantasy sin tocar código.

6. Debe permitir crear actas imprimibles limpias y útiles.

7. Debe permitir introducir estadísticas rápido después del partido.

8. Debe cuidar especialmente la privacidad de menores.

9. Debe tener una estética de club deportivo joven y cercana.

10. Debe estar preparada para crecer en el futuro.

---

## Formato de respuesta esperado

Construye una primera versión funcional de la app con:

* Página de inicio

* Página de rankings

* Página de equipos

* Página de jugador/a

* Página de partidos

* Panel de administración

* Generador de acta PDF

* Formulario de estadísticas

* Sistema de puntuación configurable

* Subida de archivos de acta

Incluye datos de ejemplo para probar la app:

* 2 temporadas

* 4 equipos

* 20 jugadores/as ficticios

* 5 partidos ficticios

* Ranking inicial con puntos calculados

Usa nombres ficticios para jugadores/as y evita datos reales de menores.

Prioriza una versión visual y funcional antes que una versión demasiado compleja.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bzg-fantasy-goi.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ba0eeda2-dc4f-4f44-a7cf-8c7c3724d758).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
