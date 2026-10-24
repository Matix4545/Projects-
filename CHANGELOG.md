# Historial de versiones · Reporta Cajeme

## 1.2.1 — 24 de octubre de 2026

### Medir recorrido (solo equipo)
- Cada tramo guarda datos para **calibrar a IRI después** sin volver a recorrer las calles:
  rugosidad de la parte lenta (< 4 Hz, el rebote de la carrocería), percentil 95 de los golpes
  y qué tanto varió la velocidad.
- `/medir` pregunta dónde va el celular (rejilla, parabrisas, tablero…) y guarda si es Android
  o iPhone. Casilla "Es un recorrido de prueba" con una nota (p. ej. "Calle 300 a 40 km/h").
- Los golpes se ubican donde iba el vehículo en ese instante, no en la última lectura del GPS.
- `/estadisticas`: sección "Recorridos medidos" (km por estado, recorridos de prueba) y descarga
  de todos los tramos en CSV.
- Requiere correr `01_esquema.sql`, `02_funciones.sql` y `03_seguridad.sql`.

## 1.2 — 22 de octubre de 2026

### Mapa público
- **Calles cerradas y calles con baches.** Nuevo tipo de reporte que se marca como tramo:
  se toca dónde empieza y dónde termina, y la línea se ajusta a la calle. Rojo = cerrada
  (obra, inundada o fuga, accidente, otro); amarillo = baches en más de la mitad o toda la calle.
  Se quitan con 3 votos de "Ya la abrieron" / "Ya la arreglaron".
- **Agua: 7 días.** Las colonias se pintan con lo reportado en los últimos 7 días (antes 72 h;
  24 h y 72 h siguen disponibles). Un reporte de "Con agua" pone la colonia en verde y deja sin
  efecto los reportes de problema anteriores. Sin reportes en 7 días, vuelve a gris.
- Leyenda y panel de colonia con el estado directo ("Sin agua", "Con agua"…).
- "Acerca de" actualizado y con número de versión.

### Solo equipo (con la contraseña del panel)
- Mapa del equipo: días sin resolver con semáforo y folio, filtros (puntos o calor, estado,
  fecha), mapa de calor y notas privadas por reporte.
- `/estadisticas`: reportes activos, % resuelto, tiempo promedio, desempeño por dependencia,
  colonias con más pendientes y los reportes más olvidados.
- Secciones electorales (215 de Cajeme): capa en el mapa, top 5 en Filtros, top 15 en
  estadísticas y las 3 primeras en los avisos de ntfy.

### Base de datos
Requiere correr `01_esquema.sql`, `02_funciones.sql` y `03_seguridad.sql`, y cargar
`data/secciones.geojson` con el workflow "Importar secciones electorales".

## 1.1 — 15 al 20 de octubre de 2026
- Alumbrado público, banquetas y baldíos como reportes con punto.
- Panel privado de reporte ejecutivo (`/panel`) con descarga a Excel.
- Colonias oficiales del IMIP Cajeme (importación desde archivo o ArcGIS); colonias visibles
  en gris aunque no tengan reportes.
- Selector de periodo 24 h / 72 h / 7 días.
- Preparación para tráfico masivo: caché en Vercel, límites por teléfono además de por IP
  y fotos más ligeras.

## 1.0 — 14 de octubre de 2026
- Lanzamiento: agua por colonia, baches y drenaje con punto, +1 y "Ya lo arreglaron",
  reportes anónimos con Turnstile, límites, filtro de groserías, denuncias, fotos sin
  metadatos, aviso de privacidad y avisos al administrador cada 100 reportes.
