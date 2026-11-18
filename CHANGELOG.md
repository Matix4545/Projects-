# Historial de versiones · Reporta Cajeme

## 1.3 — 17 de noviembre de 2026

### Baches con la cámara (solo equipo)
- En `/medir`, con la sesión del equipo, se puede activar **“Detectar baches con la cámara”**: el
  celular en el parabrisas detecta cada bache con un modelo de segmentación que corre **en el
  celular** (onnxruntime-web, con WebGPU si hay; el video no se envía).
- **Tamaño en m²** sobre el plano de la calle: el contorno se proyecta al piso con la altura de la
  cámara, su inclinación (sensores) y el campo de visión; área con Gauss–Green. Solo se mide en la
  “zona dulce” (3–14 m adelante, bache completo en la imagen) y se publica la mediana de varios cuadros.
- **Calibración** con un rectángulo de medida conocida en el piso (hojas, tapete, cajón de
  estacionamiento): ajusta el campo de visión y, si se quiere, la altura.
- Los baches confirmados (vistos en varios cuadros) se suben solos con un recorte de foto. Si ya hay un
  bache activo a menos de 8 m, se le suma la detección y se recalcula su tamaño.
- Modelos con varias clases (p. ej. bache, alcantarilla, rejilla): solo se suben los baches. Umbral por
  clase: 0.15 para ser candidato; bache 0.25, grieta 0.20, lo demás 0.35; 0.5 para subirlo al mapa.
- **Medida de referencia** con una hoja carta (homografía de 4 puntos) para comprobar la medida de la
  cámara contra la realidad.
- **Niveles de bache** por diámetro equivalente (rangos de ASTM D6433): chico (menos de 45 cm),
  mediano (45–75 cm) y grande (más de 75 cm), los mismos tamaños que ya usan los vecinos. En la cámara
  (vista al manejar y resumen): **chico verde, mediano amarillo, grande rojo**. El mapa público se ve
  como siempre (baches amarillos, más grandes si son más grandes, borde rojo si son peligrosos); el
  formulario explica los tamaños.
- Un bache de la cámara se publica como un reporte normal ("Bache mediano"…). Si no se pudo medir no se
  publica; si cae sobre uno ya reportado, su tamaño pasa a ser el medido (salvo "peligroso").
- **Ubicación con GPS más precisa:** la posición de cada cuadro se interpola entre lecturas del GPS (con la
  hora de cada lectura); el bache se acomoda dentro de la calle por la que iba el vehículo (calles de
  OpenStreetMap, workflow **"Importar calles"**), se guarda el nombre de la calle y cada pasada afina su
  ubicación.
- El mapa muestra el tamaño medido, el nivel y en cuántos recorridos lo vio la cámara.
- `/estadisticas`: descarga de todas las detecciones en CSV.
- **Recorrido de prueba**: con la casilla activada, los baches de la cámara se guardan con la nota de la
  prueba pero no se publican en el mapa.
- **Medida de referencia guardada** (con la ubicación del celular) y sección **"Precisión de la cámara"** en
  `/estadisticas`: cada referencia contra lo que midió la cámara a menos de 10 m, error medio y MAPE, con CSV.
- Workflow **“Instalar modelo de baches”**: instala un modelo entrenado en Ultralytics Platform
  (`.onnx` o `.pt`) desde el repositorio o un enlace.
- Requiere correr `01_esquema.sql`, `02_funciones.sql` y `03_seguridad.sql`.

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
- `/estadisticas`: **impacto económico preliminar** (método simplificado de HDM-4): IRI estimado,
  costo extra por km, por vehículo al año y total para Cajeme, con rango bajo–alto. Todos los
  supuestos están en `lib/economia.ts` y se reemplazan cuando haya calibración y datos locales.
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
