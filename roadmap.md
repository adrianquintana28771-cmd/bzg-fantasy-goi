# Pendiente

- [x] Inicio: los nombres de las 6 clasificaciones (goles, paradas, asistencias, robos, % paradas y media de puntos) son enlaces a la ficha de cada jugador/a, con su identificador real; cálculos, orden y diseño intactos.

- [x] Añadir vista Admin de auditoría de puntos por jornada, origen registrado/autocalculado y diferencias, sin modificar datos; seis pruebas de cálculo correctas.
- [ ] Comprobar vista de auditoría con sesión super_admin (sesión actual es usuario normal, acceso denegado correctamente).

- [x] Revisar puntuaciones por jornada: retirados autocalculos de entrenadores, corregidos 5 casos (15 cartas); Eneko J3=0 verificado en ficha real, pruebas SQL correctas y 666 filas de jugadores/porteros intactas.

- [x] Equipo: usar solo la mitad derecha de cada plantilla, foto en su hueco y datos en el resto; tres fichas por fila en inventario y selector.

- [x] Equipo: reutilizar las fichas existentes por rareza con foto en su hueco e información actual (nombre y primer apellido, posiciones, usos, puntos de jornada y media), sin cambiar cálculos; comprobado con sesión real sin escrituras.

- [x] Selector de jugadores de Equipo: foto a la izquierda a altura completa de la tarjeta, info a la derecha y fondo gris/azul/dorado según rareza (solo en esas tarjetas; resto de vistas sin cambios).
- [ ] Publicar en bzgfantasy.app los cambios ya verificados en la vista previa (portada con última jornada cerrada, selector de jornadas en Mi equipo, tarjetas del selector).
- [x] Fichas visuales por rareza: las tres plantillas gráficas existentes se reutilizan en Mis jugadores y el selector de Equipo.
- [ ] Nora Aretxaga y Mario López tienen sus fotos guardadas como .jpeg pero su ficha apunta a .png: se ven con el marcador de reserva. Fuera del alcance actual, se corregirá si se pide.


- [x] Compatibilidad PNG/WebP, prioridad WebP y reserva común/placeholder (formatos, MIME y fallos verificados con respuestas locales simuladas; ficha real carga; sin escrituras reales).

- [x] Fondo de fotos con degradado y logo; fotos por rareza en huecos y selección de plantilla (verificado sin guardar alineaciones; cuenta actual sin fotos coincidentes, carga comprobada con respuesta local simulada).

- [x] Traducir Misiones al euskera y configurar tutorial, Federación y web BZG como las tres primeras misiones.
- [x] Dar a cada cuenta nueva 3 sobres normales y 1 premium.
# Roadmap
- [x] Mini-tutorial guiado para nuevas visitas, usuarios y administración
- [ ] Viernes: reiniciar sobres/cartas de usuarios como recién registrados (esperando aviso del usuario)
- [x] BZG Berde (senior femenino) con 15 jugadoras
- [x] Ficha jugador: desempeño por jornada + total (datos reales)
- [x] Web en euskera por defecto + ESP, acceso en panel lateral
- [ ] Traducir página de nueva contraseña y panel de admin
- [ ] Conectar Inicio, Partidos y ranking de jugadores a datos reales
- [ ] Resto de equipos y entrenadores reales
- [x] Listado de jugadores/entrenadores por equipo con datos que faltan
