# Catálogo de patrones y transformaciones

Generado con `npm run patron -- catalogo`. Cada modelo se genera con `npm run patron -- <id>`.

## Patrones base

Los bloques de los que salen todas las transformaciones: cuerpo, manga, falda y pantalón, con holguras para tela plana.

### Cuerpo base `cuerpo-base`

Delantero y espalda a la cintura, con pinza de busto en el costado y pinzas de cintura. Holgura de 10 cm en busto.

1. Traza un rectángulo de medio contorno de busto + 5 cm de ancho por el talle de espalda de alto.
2. Baja la línea de busto (busto/12 + 13.5 cm) y marca el ancho de espalda y el ancho de pecho.
3. Sube el delantero (busto/5 + 8.3 cm sobre la línea de busto) para dar el largo que pide el busto.
4. Traza escotes, hombros (18° en espalda, 22° en delantero) y sisas perpendiculares al hombro y al costado.
5. Abre la pinza de busto con ángulo de (busto/4 − 2.5)° hacia el punto de busto y pásala al costado.
6. Reparte lo que sobra en la cintura entre costados y pinzas; las pinzas delanteras terminan 2.5 cm antes del busto.

### Blusa base con manga `blusa-base`

El cuerpo base alargado a la cadera, con pinzas de pez y manga montada. Es la base para escotes, cuellos y mangas.

1. Parte del cuerpo base con la pinza de busto en el costado.
2. Alarga el centro y el costado hasta la cadera + 2 cm; abre el costado al ancho de cadera más holgura.
3. Convierte las pinzas de cintura en pinzas de pez (rombo) que terminan 13 cm abajo de la cintura.
4. Traza la manga con la medida de la sisa: la copa mide la sisa + 2.5 cm de embebido.

### Manga base `manga-base`

Manga montada larga, con copa calculada para la sisa del cuerpo base y piquetes de delantero (1) y espalda (2).

1. Ancho de bíceps = contorno de brazo + 5 cm; divide en delantero (−0.5) y espalda (+0.5).
2. Busca la altura de copa con la que la curva de copa mide la sisa + 2.5 cm (embebido).
3. Traza la copa en S: convexa arriba y cóncava abajo, más llena atrás.
4. Baja el largo de brazo; la bastilla mide muñeca + 10 cm. Marca la línea de codo.

### Falda base (recta) `falda-base`

Falda recta a la rodilla con dos pinzas por pieza, delantero al doblez y espalda con cierre al centro.

1. Ancho de cada cuarto: cadera/4 + 1 cm (+0.5 delantero, −0.5 espalda). Baja la altura de cadera y el largo.
2. Cintura terminada: cintura/4 + 0.5 cm. Lo que sobra se reparte entre el costado (curva de cadera) y las pinzas.
3. Sube el costado 0.8 cm en la cintura y baja 1 cm el centro espalda.
4. Pinzas delanteras de 9.5 y 8.5 cm alineadas con el busto; traseras de 14 y 12.5 cm.

### Pantalón base (recto) `pantalon-base`

Pantalón recto de tiro a la cintura, con raya, una pinza delantera y una o dos traseras.

1. Baja altura de cadera, tiro + 1 cm, rodilla y largo.
2. Delantero: cadera/4 + 0.5 cm, entrepierna de cadera/16; espalda: cadera/4 + 1.5 cm, entrepierna de cadera/10 + 0.5.
3. Centro espalda inclinado y 2.5 cm más alto en la cintura; entrepierna trasera 0.7 cm más baja.
4. La raya va al centro de la pierna; reparte ancho de rodilla y bastilla a cada lado (espalda 1 cm más por lado).
