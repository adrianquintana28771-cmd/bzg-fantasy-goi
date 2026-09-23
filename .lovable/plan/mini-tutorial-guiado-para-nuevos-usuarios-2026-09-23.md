# Mini-tutorial guiado para nuevos usuarios

## Objetivo
Añadir un recorrido inicial breve, en euskera y castellano, que explique las partes principales de BZG Fantasy sin cambiar el funcionamiento actual.

## Qué se añadirá
- Un tutorial automático en la primera visita, recordado en ese navegador para no repetirse.
- Pasos adaptados al tipo de cuenta:
  - Sin sesión: navegación pública, rankings, equipos, partidos y cómo entrar o registrarse.
  - Usuario jugador: sobres, cartas, alineación de 7 jugadores y entrenador, misiones, jornadas y rankings.
  - Administración: acceso a Desempeño y, para quien corresponda, opciones administrativas.
- Controles claros para avanzar, volver, omitir y terminar.
- Un botón de ayuda en la cabecera para poder repetir el tutorial cuando se quiera.
- El recorrido respetará el idioma EUS/ESP elegido y funcionará tanto en móvil como en escritorio.

## Detalles técnicos
- Crear un componente global de tutorial integrado en la estructura principal de la web.
- Señalar los destinos principales de navegación con identificadores estables.
- Guardar únicamente en el navegador que el tutorial ya fue completado, separado por tipo de cuenta.
- Mantener el foco dentro del tutorial, añadir etiquetas accesibles y respetar la preferencia de movimiento reducido.
- Verificar apertura automática, navegación entre pasos, cierre, repetición y presentación móvil.
