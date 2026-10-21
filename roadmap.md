# Pendiente
- [ ] Guardar y verificar copia inmutable de usuarios, colección y alineaciones; dejar todas las cartas actuales y nuevas con un uso y comprobar el descuento sin abrir sobres reales.
- [x] Desempeño: etiquetas y desglose de porteros usan criterios editables y total de auditoría, sin cambiar datos ni cálculo; 16 pruebas correctas y compilación sin errores. Comprobación con sesión administradora pendiente del acceso autorizado ya indicado abajo.
- [x] Mostrar puntos negativos a Admin y Super Admin sin cambiar cálculos; 17 pruebas correctas. Clasificaciones abre alineación real de la jornada (Total/Media muestra historial), comprobado en escritorio y móvil sin errores.
- [ ] Comprobar visualmente puntos negativos con sesión Admin/Super Admin: no hay sesión autorizada disponible; las reglas de ambos roles están verificadas por pruebas.
- [x] Criterios editables de porteros sustituyen fórmula fija por confirmación del usuario; recálculo histórico, ficha y auditoría alineados, 105 puntuaciones sin diferencias, 14 pruebas correctas y puntos no porteros intactos. Ficha real muestra total 31; guardado mediante pantalla Super Admin sigue pendiente de sesión autorizada.
- [x] Recalcular puntos de jornadas cerradas con fórmula vigente; Desempeño reutiliza cálculo de auditoría y refresca lecturas al guardar. 14 pruebas correctas y 93 puntuaciones históricas de entrenadores sin diferencias.
- [ ] Verificar guardado de Desempeño y lectura posterior en auditoría con sesión Super Admin: no hay sesión autorizada disponible.
- [x] Auditoría de porteros alineada con última fórmula: 12 pruebas correctas y 105 puntuaciones de cartas J1–J4 sin diferencias, sin modificar puntos ni estadísticas.
- [x] Corregir regresión de resultados automáticos de entrenadores: 15 puntuaciones corregidas, 4 pruebas SQL y 6 pruebas de auditoría correctas; 897 filas de jugadores/porteros idénticas, ficha real comprobada.
- [x] Códigos por partido: programación desde Super Admin, activación en hora de Madrid y caducidad 4 horas después; siete pruebas de horarios correctas y acceso sin sesión bloqueado.
- [ ] Comprobar programación y canje completos con sesión Super Admin y usuario: no hay sesión disponible; pendiente de iniciar sesión en vista previa.
- [x] Fotos algo más bajas; limpieza de fondo de Aimar Temiño aplicada a común/raro/legendario, sin cambiar otras fotos; comprobar resultado visual antes de extender a otros jugadores.
- [x] Unificar fondo de Uxue detrás de todas las fotos y sin foto, centrar fotos con ajuste a todo el hueco; comprobadas Uxue y Peio en inventario real sin cambiar archivos originales.

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
- [x] Inicio: las 6 clasificaciones tienen todo el rectángulo clicable (igual que los partidos), no solo el nombre.
- [x] Inicio «Jugador/a de la jornada»: solo la ficha completa (nombre, equipo, rareza y puntos ya van dentro); quitados los textos duplicados de fuera.
