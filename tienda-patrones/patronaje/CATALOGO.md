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

## Pinzas

La pinza de busto siempre apunta al punto de busto y puede salir de cualquier borde del delantero. Se traslada cortando hasta el punto de busto y girando.

### Pinza de costado `pinza-costado`

La más común en blusas y vestidos. Sale del costado unos 5 cm abajo de la sisa y apunta al punto de busto; termina 2 cm antes de él.

1. Marca el punto de busto (la parte más alta del busto) en el delantero.
2. En el costado, mide unos 5 cm hacia abajo desde la sisa.
3. Corta desde el punto nuevo hasta el punto de busto, cierra la pinza vieja (gira la parte cortada con centro en el busto) y la abertura que se forma es la pinza nueva.
4. Acorta la pinza 2 cm antes del punto de busto (2.5–3 cm en bustos grandes) para que no haga pico.
5. Al coser, plancha la pinza hacia abajo.

### Pinza de hombro `pinza-hombro`

Sale de la mitad del hombro hacia el punto de busto. Da forma en el pecho y es la base de los cortes princesa desde hombro.

1. Marca un punto a la mitad del hombro (un poco más cerca del cuello).
2. Corta desde el punto nuevo hasta el punto de busto, cierra la pinza vieja (gira la parte cortada con centro en el busto) y la abertura que se forma es la pinza nueva.
3. Termina la pinza 2 cm antes del busto; plánchala hacia el centro.

### Pinza de sisa `pinza-sisa`

Sale de la sisa, a la altura del ancho de pecho, hacia el busto. Queda escondida en blusas con manga.

1. Marca en la sisa el punto donde la línea de ancho de pecho toca la curva.
2. Corta desde el punto nuevo hasta el punto de busto, cierra la pinza vieja (gira la parte cortada con centro en el busto) y la abertura que se forma es la pinza nueva.
3. Así está trazada en el cuerpo base: el ángulo de la pinza es (busto ÷ 4 − 2.5)°.

### Pinza de cintura (todo el busto en la cintura) `pinza-cintura`

Toda la pinza de busto se suma a la pinza de cintura: queda una sola pinza grande alineada con el punto de busto. Ideal para vestidos entallados sin costado marcado.

1. Corta por la pata de la pinza de cintura más cercana al costado hasta el punto de busto.
2. Cierra la pinza de busto: la pinza de cintura se abre más.
3. La pinza queda vertical, alineada con el punto de busto; termina 2.5 cm antes de él.

### Pinza francesa `pinza-francesa`

Sale del costado muy cerca de la cintura y sube en diagonal al busto. Estiliza y adelgaza la figura.

1. Marca en el costado un punto a 1/5 del largo del costado, arriba de la cintura.
2. Corta desde el punto nuevo hasta el punto de busto, cierra la pinza vieja (gira la parte cortada con centro en el busto) y la abertura que se forma es la pinza nueva.
3. Es larga: termínala 3 cm antes del busto y plánchala hacia abajo.

### Pinza de centro delantero `pinza-centro`

Sale del centro delantero a la altura del busto. El centro ya no puede ir al doblez: lleva costura.

1. Marca en el centro delantero un punto a la altura del busto.
2. Corta desde el punto nuevo hasta el punto de busto, cierra la pinza vieja (gira la parte cortada con centro en el busto) y la abertura que se forma es la pinza nueva.
3. El centro queda quebrado: agrega 1.5 cm de margen y corta dos piezas (un par).

### Pinza de escote `pinza-escote`

Sale de la mitad del escote hacia el busto. Muy bonita convertida en frunces o alforzas bajo un cuello.

1. Marca un punto a la mitad de la curva del escote.
2. Corta desde el punto nuevo hasta el punto de busto, cierra la pinza vieja (gira la parte cortada con centro en el busto) y la abertura que se forma es la pinza nueva.
3. Endereza la curva del escote cerrando la pinza en papel antes de cortar.

### Pinzas dobles (paralelas) `pinzas-dobles`

La pinza de busto se reparte en dos pinzas más chicas en el costado. Quedan más planas: útil en bustos grandes.

1. Marca dos puntos en el costado separados 3 cm (el primero a 4 cm de la sisa).
2. Corta al primero y gira para cerrar la mitad de la pinza de busto.
3. Corta al segundo y cierra el resto.
4. Ambas apuntan al busto: termina la de arriba 3 cm y la de abajo 3.5 cm antes del busto.

### Pinza convertida en frunce `pinza-en-frunce`

En vez de coser la pinza, su amplitud se frunce bajo el busto. Para blusas con corte imperio o pretina.

1. Pasa toda la pinza de busto a la cintura (como en la pinza de cintura).
2. No cierres la pinza: redondea la orilla 1 cm hacia abajo entre las patas.
3. Marca piquetes 2 cm más allá de cada pata: ahí va el frunce.
4. Frunce hasta que la orilla mida lo mismo que la pieza a la que se une.

### Pinza convertida en alforzas `pinza-en-alforzas`

La pinza de busto se reparte en tres alforzas cortas en el hombro que se sueltan arriba del busto.

1. Marca tres puntos en el hombro (a 30, 50 y 70 % desde el cuello).
2. Traslada un tercio de la pinza a cada punto, cortando y girando.
3. Cose cada alforza sólo 7 cm desde el hombro y plánchalas hacia el centro.

### Pinzas de espalda `pinza-espalda`

La pinza de hombro de la espalda apunta al omóplato (7–8 cm de largo) y puede pasarse al escote; la de cintura va en línea con el omóplato.

1. La pinza de hombro está a la mitad del hombro y mide busto ÷ 32 − 0.8 cm.
2. Para pasarla al escote, marca un punto a la mitad del escote, corta hasta la punta de la pinza y gira para cerrar la del hombro.
3. La pinza de cintura sube en vertical hasta 1 cm abajo de la línea de busto.
4. Si prefieres no coser pinza de hombro, embebe ese ancho al unir los hombros (en telas que lo permitan).

## Tipos de escote

Se trazan sobre el cuerpo base: se abre el escote en el hombro y se baja en el centro. Cada escote lleva su vista.

### Escote redondo (joya) `escote-redondo`

El escote del patrón base: sigue la base del cuello. Como no pasa la cabeza, lleva abertura con botón en el centro espalda.

1. Usa el escote del cuerpo base sin cambios.
2. Marca en el centro espalda una abertura de 12 cm con botón y presilla.
3. Abre el escote la misma cantidad en el hombro del delantero y de la espalda, para que las costuras de hombro sigan midiendo igual.
4. El escote nuevo sale a 90° del centro (al doblez) y llega a 90° al hombro: así queda continuo al coser el hombro.
5. Calca la vista de escote de 6 cm de ancho siguiendo la línea nueva.

### Escote redondo amplio `escote-redondo-amplio`

Redondo más abierto y más bajo que el joya; cómodo y fácil de vestir.

1. Abre 2 cm en el hombro.
2. Baja 3 cm el centro delantero y 1 cm el centro espalda.
3. Une con una curva redonda a escuadra en el centro y en el hombro.
4. Abre el escote la misma cantidad en el hombro del delantero y de la espalda, para que las costuras de hombro sigan midiendo igual.
5. El escote nuevo sale a 90° del centro (al doblez) y llega a 90° al hombro: así queda continuo al coser el hombro.
6. Calca la vista de escote de 6 cm de ancho siguiendo la línea nueva.

### Escote en V `escote-v`

Línea recta del hombro al centro delantero, que alarga el cuello y el torso.

1. Abre 1.5 cm en el hombro.
2. Baja 12 cm el centro delantero (queda arriba del busto).
3. Une con una recta; en los últimos 3 cm endereza la línea para que llegue a 90° al hombro.
4. En la espalda conserva el escote redondo, abierto lo mismo en el hombro.
5. Abre el escote la misma cantidad en el hombro del delantero y de la espalda, para que las costuras de hombro sigan midiendo igual.
6. El escote nuevo sale a 90° del centro (al doblez) y llega a 90° al hombro: así queda continuo al coser el hombro.
7. Calca la vista de escote de 6 cm de ancho siguiendo la línea nueva.

### Escote en U `escote-u`

Escote profundo y redondeado, con lados casi rectos.

1. Abre 2.5 cm en el hombro.
2. Baja 11 cm el centro delantero y 2 cm la espalda.
3. Traza una curva llena: casi recta al bajar y redonda abajo.
4. Abre el escote la misma cantidad en el hombro del delantero y de la espalda, para que las costuras de hombro sigan midiendo igual.
5. El escote nuevo sale a 90° del centro (al doblez) y llega a 90° al hombro: así queda continuo al coser el hombro.
6. Calca la vista de escote de 6 cm de ancho siguiendo la línea nueva.

### Escote cuadrado `escote-cuadrado`

Base recta y lados casi verticales; muy usado en blusas campesinas y vestidos de verano.

1. Abre 3 cm en el hombro.
2. Baja 9 cm el centro delantero y traza la base horizontal.
3. Sube el lado casi vertical hasta el hombro y redondea la esquina con 1.5 cm.
4. En la espalda baja 2 cm con escote redondo.
5. Abre el escote la misma cantidad en el hombro del delantero y de la espalda, para que las costuras de hombro sigan midiendo igual.
6. El escote nuevo sale a 90° del centro (al doblez) y llega a 90° al hombro: así queda continuo al coser el hombro.
7. Calca la vista de escote de 6 cm de ancho siguiendo la línea nueva.

### Escote barco (bateau) `escote-barco`

Escote ancho y poco profundo que va casi de hombro a hombro.

1. Abre 5.5 cm en el hombro (la pinza de hombro de la espalda pasa a la sisa).
2. Sube el centro delantero hasta 2 cm abajo del punto nuevo del hombro y deja la espalda 1 cm abajo.
3. Une con una línea casi recta que llegue a escuadra al hombro.
4. Abre el escote la misma cantidad en el hombro del delantero y de la espalda, para que las costuras de hombro sigan midiendo igual.
5. El escote nuevo sale a 90° del centro (al doblez) y llega a 90° al hombro: así queda continuo al coser el hombro.
6. Calca la vista de escote de 6 cm de ancho siguiendo la línea nueva.

### Escote corazón `escote-corazon`

Dos curvas sobre el busto que se juntan en pico al centro delantero, con tirantes anchos.

1. Abre 4 cm en el hombro (la pinza de hombro de la espalda pasa a la sisa).
2. Marca el pico del centro 2 cm arriba del punto de busto.
3. Marca la parte alta de cada curva 8 cm arriba del punto de busto.
4. Une: del pico sube en curva hasta la parte alta, sigue horizontal y sube al tirante, llegando a 90° al hombro.
5. En la espalda baja el escote 6 cm.
6. Si el escote se abre al probar, quita 0.5–1 cm en la orilla del escote y pásalo a la pinza de costado.

### Escote halter `escote-halter`

El delantero se sostiene con una tira que se anuda al cuello; hombros y espalda alta descubiertos.

1. Marca en el escote delantero un punto a 3 cm del cuello y traza ahí el tirante de 3.5 cm.
2. Baja 2 cm el fondo de sisa en el costado.
3. Recorta la sisa con una curva del tirante al costado (entrando hacia el centro).
4. En la espalda traza el borde superior casi recto, del costado al centro, 2 cm más bajo en el centro.
5. Corta dos tiras de 50 × 8 cm para anudar al cuello.

### Escote asimétrico (un hombro) `escote-asimetrico`

Un solo hombro: la línea del escote cruza en diagonal del hombro a la sisa contraria.

1. Calca el delantero y la espalda completos (reflejando el doblez del centro).
2. En el hombro que se queda marca un punto a 2.5 cm del cuello.
3. En el costado contrario baja 2 cm el fondo de sisa.
4. Une con una curva suave que salga a 90° del hombro; haz lo mismo en la espalda.
5. Corta las piezas completas con el derecho de la tela hacia arriba. La sisa se termina con bies.

### Escote palabra de honor (strapless) `escote-palabra-de-honor`

Sin tirantes: el borde superior pasa arriba del busto y bajo los brazos. Se ajusta al cuerpo y lleva varillas.

**Telas:** Telas firmes (tafeta, gabardina ligera, satín grueso) con entretela y forro.

1. Usa un cuerpo ajustado: 4 cm de holgura en busto y 2 cm en cintura, largo a la cintura.
2. Marca el borde 8.5 cm arriba del punto de busto en el centro y 2 cm abajo de la sisa en el costado.
3. Une con una curva suave; en la espalda el borde va recto, 1 cm más bajo al centro.
4. Cierre al centro espalda. Pon varillas en costados, pinzas y centro delantero; forra el cuerpo completo.
5. Al probar, el borde debe quedar firme: si se separa del cuerpo, quita 0.5 cm en cada costado.

### Escote cascada (cowl) `escote-cascada`

Pliegues suaves que caen al frente. El delantero se corta al bies para que la tela caiga.

**Telas:** Telas con mucha caída: crepé, satín, viscosa, seda, jersey de rayón.

1. Abre 2 cm el escote en el hombro y baja el centro delantero 9 cm con una línea recta (escote en V).
2. Traza tres cortes del centro delantero (a 3, 7 y 11 cm abajo de la V) a la línea de hombro.
3. Corta y abre cada corte en el centro, sin separar el hombro, hasta que el centro de abajo quede a escuadra con la línea del hombro al fondo de la V.
4. Traza el centro nuevo recto de la bastilla al fondo de la V y alárgalo; el borde de la cascada sale del hombro a escuadra con ese centro.
5. Agrega 7 cm de vista incluida reflejando el hombro.
6. Calca la pieza completa y córtala al bies (el centro a 45° del hilo).

### Escote ojo de cerradura `escote-ojo-de-cerradura`

Escote redondo con una abertura en gota al centro delantero; en la espalda, botón con presilla.

1. Parte del escote redondo.
2. Marca la gota en el centro delantero: empieza 1.5 cm abajo del escote, mide 9 cm de largo y 5 cm de ancho.
3. Calca una vista que rodee el escote y la gota (5 cm de ancho).
4. En la espalda marca una abertura de 10 cm con botón y presilla al bies.

### Escote en V en la espalda `escote-v-espalda`

El escote delantero queda alto y la espalda baja en V profunda hasta la línea del brasier.

1. Abre 1.5 cm en el hombro, delante y atrás.
2. Baja el centro espalda hasta 4 cm abajo de la línea de busto.
3. Une con una recta que se endereza al llegar al hombro.
4. Si la V se abre al probar, quita 0.5 cm en la orilla y pásalo a la pinza de hombro.
5. Abre el escote la misma cantidad en el hombro del delantero y de la espalda, para que las costuras de hombro sigan midiendo igual.
6. El escote nuevo sale a 90° del centro (al doblez) y llega a 90° al hombro: así queda continuo al coser el hombro.
7. Calca la vista de escote de 6 cm de ancho siguiendo la línea nueva.

## Tipos de cuello

Los cuellos se trazan con la medida del escote: largo del escote de espalda más el del delantero.

### Cuello mao (mandarín) `cuello-mao`

Banda recta de 3.5 cm que sube pegada al cuello, con botón al frente.

1. Mide el escote ya cosido: espalda (centro a hombro) + delantero (hombro a centro). El borde de cuello debe medir lo mismo.
2. Traza el borde de cuello: recto la medida de espalda y luego curvo, subiendo 1.5 cm en el frente; agrega el cruce de botones.
3. Sube 3.5 cm en el centro espalda y 3 cm en el frente, paralelo al borde de cuello.
4. Redondea la esquina del frente y marca piquetes en el hombro y en el centro delantero.

### Cuello camisero (con pie de cuello) `cuello-camisero`

El cuello de camisa: un pie de cuello con botón y un cuello con puntas que dobla sobre él.

1. Mide el escote ya cosido: espalda (centro a hombro) + delantero (hombro a centro). El borde de cuello debe medir lo mismo.
2. Pie de cuello: borde recto en la espalda y curvo al frente, subiendo 2 cm; 3 cm de alto; llega hasta el cruce y se redondea.
3. Cuello: su borde de abajo mide el borde de arriba del pie hasta el centro delantero; baja 1.2 cm al frente (al revés del pie).
4. Alto del cuello: 4.5 cm en el centro espalda; la punta sale 1.6 cm hacia afuera.

### Cuello sport (convertible) `cuello-sport`

Cuello de una pieza que se puede usar abotonado o abierto formando pequeñas solapas.

1. Mide el escote ya cosido: espalda (centro a hombro) + delantero (hombro a centro). El borde de cuello debe medir lo mismo.
2. Borde de cuello recto en la espalda y con 0.8 cm de subida al frente, hasta el centro delantero.
3. Alto 7.5 cm parejo; la punta sale 2.5 cm.
4. Marca la línea de quiebre a 3 cm del borde de cuello. La vista delantera forma las solapas al abrir.

### Cuello bebé (Peter Pan) `cuello-peter-pan`

Cuello plano y redondeado que descansa sobre los hombros.

1. Junta el delantero y la espalda por el hombro, con los puntos de cuello unidos y las puntas de hombro traslapadas 1.5 cm.
2. Calca el escote del centro delantero al centro espalda: ése es el borde de cuello.
3. Traza el borde exterior a 7 cm del escote y redondea la esquina del frente.
4. El centro espalda va al doblez.

### Cuello sastre (con solapa) `cuello-solapa`

El cuello de saco: solapa que dobla sobre el pecho y cuello separado con muesca.

1. Agrega 2 cm de cruce y marca el punto de quiebre en el borde delantero, 1 cm abajo de la línea de busto.
2. Prolonga el hombro 2 cm hacia el cuello: la línea de quiebre va de ese punto al punto de quiebre.
3. Dibuja la solapa del otro lado de la línea de quiebre (8.5 cm de ancho); la muesca va al 70% del quiebre, a 4 cm de la línea, y de ahí la escotadura sube al 45% del escote.
4. Cuello: desde el punto de cuello traza la medida de espalda paralela al quiebre, separándola 2.5 cm en el centro; 7.5 cm de ancho (3 de pie y 4.5 de caída).
5. La punta del cuello forma la muesca con la solapa.

### Cuello chal `cuello-chal`

Solapa y cuello en una sola pieza con el delantero, sin muesca, con costura al centro espalda.

1. Agrega 2 cm de cruce y marca el punto de quiebre 1 cm abajo de la línea de busto.
2. Línea de quiebre del punto de quiebre a 2 cm más allá del cuello sobre la línea del hombro.
3. Desde el punto de cuello traza la medida de espalda paralela al quiebre, separada 2.5 cm en el centro espalda; escuadra 8 cm.
4. Une con una curva continua del punto de quiebre al centro espalda del cuello.
5. La vista lleva la misma forma; delantero y vista se unen en el centro espalda.

### Cuello marinero `cuello-marinero`

Escote en V al frente y un cuello plano que cae cuadrado sobre la espalda.

1. Baja el escote delantero en V hasta 6 cm arriba del punto de busto.
2. Junta delantero y espalda por el hombro traslapando 2 cm en la punta.
3. En la espalda baja 20 cm por el centro y escuadra hacia el hombro (ancho de escote + 10 cm).
4. Une esa esquina con un punto a 9 cm del cuello sobre el hombro y de ahí al fondo de la V.

### Cuello alto (tortuga) `cuello-alto`

Banda doblada que sube por el cuello. En tela plana lleva cierre atrás; en punto, 10% más corta y sin cierre.

1. Abre el escote 1 cm en el hombro y bájalo 1 cm adelante y 0.5 cm atrás para que no apriete.
2. Banda: largo del escote completo × 14 cm (7 cm doblada).
3. Espalda con costura y cierre al centro.

### Cuello con lazo `cuello-lazo`

Tira que rodea el escote y se anuda en moño al frente, sobre una pequeña abertura.

1. Abre el escote 1 cm y bájalo 1.5 cm adelante. Marca una abertura de 8 cm al centro delantero.
2. Tira: medio escote + 55 cm de lazo, por 15 cm de ancho (se dobla a la mitad).
3. Corta dos medias tiras y únelas en el centro espalda; la punta del lazo va al sesgo.
4. Abertura con botón en el centro espalda.

### Cuello de volante `cuello-volante`

Volante circular que cae en ondas alrededor del escote.

1. Mide el escote completo y calcula el radio: escote ÷ 2π.
2. Traza el círculo interior con ese radio y el exterior 7 cm más grande.
3. Abre el círculo en el centro espalda y marca piquetes de hombros y centro delantero.
4. Abertura con botón en el centro espalda.

## Tipos de manga

Salen de la manga base: se corta y se separa para dar vuelo o frunce, o se une al cuerpo (raglán, kimono).

### Manga corta `manga-recta-corta`

La manga base cortada a medio brazo, con la bastilla casi del ancho del bíceps. La más usada en blusas y vestidos.

1. Calca la manga base con sus piquetes de copa.
2. Mide desde la copa el largo deseado (unos 18–20 cm para talla M) y traza la bastilla recta.
3. Deja la bastilla 1.5 cm más angosta que el bíceps de cada lado para que no se abra.
4. Agrega 2.5 cm de dobladillo con los costados en espejo.

### Manga tres cuartos `manga-tres-cuartos`

Termina entre el codo y la muñeca (78 % del largo de brazo). Favorecedora y práctica.

1. Sobre la manga base marca el largo a tres cuartos (más o menos 10 cm abajo del codo).
2. El ancho de la bastilla es el contorno del brazo a esa altura más 8 cm de holgura.
3. Une la bastilla con los costados en línea recta desde el bíceps.

### Manga ajustada con pinza de codo `manga-ajustada`

Manga larga de una pieza, angosta en la muñeca, con pinza de codo para que el brazo se doble con comodidad.

1. Angosta la bastilla a la muñeca + 5 cm y córrela 1.5 cm hacia el frente (el brazo cuelga hacia adelante).
2. Baja 2.5 cm la esquina trasera de la bastilla: la costura de atrás queda más larga.
3. La diferencia entre la costura trasera y la delantera es el ancho de la pinza de codo.
4. Traza la pinza en la costura trasera, a la altura del codo, de 9 cm de largo hacia el centro.

### Manga campana `manga-campana`

Se abre en la bastilla como campana; la copa queda igual a la base, así que se monta sin frunce.

**Telas:** Telas con caída: rayón, crepé, gasa.

1. Divide la manga en 7 tiras con 6 cortes verticales de la bastilla hasta la copa.
2. Corta hasta la copa sin separarla (bisagra) y abre cada corte en la bastilla (unos 5 cm).
3. Redondea la bastilla bajándola un poco al centro y une las tiras con una curva suave.
4. Como hay mucho vuelo, termina la orilla con dobladillo angosto o bies.

### Manga globo (abullonada) `manga-globo`

Manga corta con volumen arriba y abajo, fruncida en la copa y en una tira que ajusta al brazo.

1. Usa la manga corta base y divídela en 7 tiras.
2. Abre los cortes 3.5 cm en la copa y 1.5 cm en la bastilla.
3. Sube 3 cm el centro de la copa para que tenga volumen y baja 1.5 cm el centro de la bastilla.
4. Frunce la copa entre los piquetes hasta que mida lo mismo que la sisa.
5. Frunce la bastilla a la tira: contorno de brazo + 3 cm de holgura.

### Manga farol `manga-farol`

Manga a medio brazo con volumen parejo, fruncida arriba y abajo como un farolito.

1. Corta la manga base a 55 % del largo de brazo y divídela en 7 tiras.
2. Separa las tiras en paralelo 3 cm (la misma amplitud en la copa y en la bastilla).
3. Sube 2 cm la copa y baja 2.5 cm la bastilla al centro para que el volumen caiga bonito.
4. Frunce la copa entre piquetes y la bastilla a una tira de 3 cm.

### Manga obispo `manga-obispo`

Manga larga con vuelo abajo, fruncida en un puño; la parte de atrás es más larga para que el blusón caiga hacia el codo.

1. Usa la manga base larga, quítale el alto del puño y súmale 3 cm de blusón.
2. Divide en 7 tiras y abre cada corte 4.5 cm sólo en la bastilla.
3. Baja 4 cm la mitad trasera de la bastilla (curva) para dar largo en el codo.
4. Marca la abertura del puño en la mitad trasera y frunce la bastilla al puño (muñeca + 4 cm + 2 cm de cruce).

### Manga jamón `manga-jamon`

Muy abullonada en el hombro y ajustada del codo a la muñeca. Típica de blusas victorianas y de novia.

1. Parte de la manga ajustada con pinza de codo.
2. Redibuja la copa: súbela 6.5 cm al centro y sácala 3.5 cm hacia afuera a cada lado, en forma de hongo.
3. Del codo hacia abajo la manga no cambia.
4. Frunce o haz pliegues en la copa entre los piquetes hasta que mida la sisa.

### Manga raglán `manga-raglan`

La costura de la manga va en diagonal del cuello a la axila. La manga incluye la parte del hombro; cómoda y deportiva.

1. En delantero y espalda marca un punto en el escote a 3 cm del hombro y une con una curva suave hasta el piquete de la sisa.
2. En la espalda pasa antes la pinza de hombro al escote.
3. Corta los cuerpos por esa línea: la parte del hombro se va a la manga.
4. Divide la manga al centro. Pega cada hombro a su mitad haciendo coincidir el piquete de sisa y apoyando el punto de hombro en la copa.
5. Une el punto de hombro con el centro de la manga con una curva: es la costura de hombro y brazo.

### Manga kimono `manga-kimono`

La manga se corta en una sola pieza con el cuerpo, sin costura en la sisa. La axila se baja y se redondea.

1. Pasa la pinza de busto al hombro (el costado debe quedar libre).
2. Prolonga la línea de hombro hacia afuera con 35° de caída y mide el largo de manga desde el hombro.
3. Baja 4 cm sobre el costado y traza desde ahí la línea bajo brazo, paralela al hombro.
4. Cierra la bastilla y redondea la esquina de la axila con 5 cm de radio.
5. Como delantero y espalda bajan lo mismo, la costura bajo brazo mide igual en las dos piezas.

### Manga murciélago `manga-murcielago`

Manga unida al cuerpo con la axila muy profunda, casi en la cintura: queda como un ala al levantar el brazo.

1. Parte de la blusa con la pinza de busto en el hombro.
2. Prolonga el hombro con 20° de caída hasta el largo de brazo (en la espalda ajusta la caída para que la costura bajo brazo mida igual).
3. En la muñeca la manga mide la mitad de muñeca + 8 cm.
4. Traza una curva amplia de la muñeca al costado, 4 cm arriba de la cintura.
5. Para que no se suba, termina la manga y la cintura con puño o resorte.

### Manga de hombro caído `manga-caida`

La costura de la sisa cae sobre el brazo: el hombro del cuerpo se alarga y la copa de la manga es baja y ancha.

1. Alarga el hombro 6 cm (y baja 1 cm la punta) en delantero y espalda.
2. Baja la sisa 3 cm en el costado y traza la sisa nueva, más recta.
3. Mide las sisas nuevas. Traza una manga con bíceps de brazo + 10 cm y copa baja (casi sin embebido).
4. Quita a la manga los 6 cm que ganó el hombro.

### Manga mariposa `manga-mariposa`

Manga corta en semicírculo que cae en ondas; se cose sólo en la parte alta de la sisa, sin costura bajo el brazo.

1. Mide la copa de la manga base entre los piquetes delantero y trasero (sin embebido).
2. Ese largo es el borde interior de un semicírculo: radio = largo ÷ 3.14.
3. Traza el borde exterior a 11 cm en el centro, bajando a cero en las puntas.
4. Cose la orilla con dobladillo de pañuelo y monta la manga entre los piquetes; el resto de la sisa lleva vista o bies.

### Manga casquillo `manga-casquillo`

Manguita que sólo cubre la punta del hombro. Es la parte alta de la copa, forrada.

1. Marca en la copa los piquetes delantero y trasero.
2. Traza una curva de piquete a piquete que baje unos 4 cm por debajo de los piquetes en el centro.
3. Corta la pieza en tela y en forro; únelas por la orilla curva y voltea.
4. Monta entre los piquetes; el resto de la sisa se termina con vista o bies.

### Manga pétalo (tulipán) `manga-petalo`

Dos piezas curvas que se cruzan sobre el hombro como pétalos de tulipán.

1. Usa la manga corta y marca dos puntos en la copa, a 4.5 cm a cada lado del piquete de hombro.
2. Desde la esquina trasera de la bastilla traza una curva hasta el punto delantero de la copa: es el pétalo trasero.
3. Desde la esquina delantera, una curva hasta el punto trasero: es el pétalo delantero.
4. Forra cada pétalo, únelos por la costura bajo brazo y encima uno al otro en la copa.

### Manga camisera con puño `manga-camisera`

Manga de camisa: copa baja y bíceps amplio, dos pliegues, abertura con tira y puño abotonado.

1. Traza la manga con 8 cm de holgura de bíceps y sólo 1 cm de embebido (copa más baja).
2. Quita el alto del puño al largo y suma 2 cm de blusón.
3. La bastilla mide el puño más dos pliegues de 2.5 cm.
4. Marca la abertura de 12 cm a un cuarto del ancho desde atrás y los pliegues hacia ella.
5. Puño: muñeca + 6 cm, con 2 cm de cruce para botón y ojal.

## Cortes de vestido

Los cortes (princesa, imperio, cintura) se hacen pasando las pinzas a costuras.

### Vestido recto (tubo) `vestido-recto`

Vestido ajustado a la rodilla, sin costura en la cintura: las pinzas de cintura se vuelven pinzas de pez. Cierre en el centro espalda.

**Telas:** Gabardina con elastano, crepé, lino grueso, jacquard.

1. Parte del cuerpo base con la pinza de busto en el costado.
2. Alarga centro y costado hasta la rodilla; abre el costado al ancho de cadera más 4 cm de holgura.
3. Convierte las pinzas de cintura en pinzas de pez: 13 cm abajo de la cintura en el delantero y 15 cm en la espalda.
4. Cierra 1 cm cada costado en la bastilla para que caiga recto (efecto tubo).
5. Abre la espalda al centro para el cierre invisible de 55 cm y traza vistas de escote y sisa.

### Vestido túnica (suelto) `vestido-tunica`

Vestido recto y holgado que cae desde el busto, sin pinzas de cintura; solo lleva pinza de busto en el costado.

**Telas:** Lino, popelina, rayón, crepé.

1. Usa el cuerpo base con la pinza de busto en el costado y quita las pinzas de cintura.
2. Baja el costado recto desde la pinza hasta la cadera (holgura de 8 cm) y la bastilla, abriendo 1.5 cm.
3. Iguala el largo de los costados delantero y espalda.
4. Cierre en el centro espalda; vistas de escote y sisa.

### Vestido línea A `vestido-linea-a`

Ajustado arriba y abierto en forma de A hacia la bastilla. Parte de la pinza de busto se convierte en vuelo.

**Telas:** Popelina, lino, piqué, gabardina ligera.

1. Parte del vestido suelto (pinza de busto en el costado, sin pinzas de cintura).
2. Corta del punto de busto a la bastilla y cierra la mitad de la pinza de costado: se abre vuelo abajo.
3. En la espalda corta de la bastilla a la sisa y abre 8 cm.
4. Agrega 3 cm de vuelo en cada costado y redondea la bastilla.

### Vestido trapecio `vestido-trapecio`

Vestido muy abierto desde los hombros, sin pinzas: toda la pinza de busto se convierte en vuelo en la bastilla.

**Telas:** Telas con cuerpo: gabardina, piqué, lino grueso, neopreno.

1. Parte del vestido suelto con la pinza de busto en el costado.
2. Corta del punto de busto a la bastilla y cierra toda la pinza de costado.
3. En la espalda corta de la bastilla a la sisa y abre 12 cm.
4. Agrega 4 cm de vuelo en cada costado y redondea la bastilla.

### Vestido corte princesa (desde el hombro) `vestido-princesa-hombro`

Costuras verticales que salen del hombro, pasan por el busto y bajan a la bastilla; dan un ajuste perfecto sin pinzas.

**Telas:** Crepé, satén grueso, gabardina con elastano, lino.

1. Pasa la pinza de busto al hombro; la pinza de cintura ya apunta al punto de busto.
2. Une las dos pinzas con una línea que pasa por el busto: esa es la costura princesa.
3. Separa el panel centro y el panel costado; suaviza la curva sobre el busto.
4. Debajo de la cintura sigue la pinza hasta la cadera y baja a la bastilla con 2 cm de vuelo por costura.
5. En la espalda une la pinza de hombro con la de cintura de la misma forma. Cierre al centro espalda.

### Vestido corte princesa (desde la sisa) `vestido-princesa-sisa`

La costura princesa sale de la sisa en curva, pasa por el busto y baja a la bastilla. Es la versión más usada en vestidos de fiesta.

**Telas:** Crepé, satén, tafeta, piqué.

1. Deja la pinza de busto en la sisa (como en el cuerpo base).
2. En la espalda pasa la pinza de hombro a la sisa, a la altura del ancho de espalda.
3. Une cada pinza de sisa con su pinza de cintura y separa los paneles.
4. Suaviza la curva sobre el busto y la del omóplato; iguala el largo de las costuras.
5. Baja los paneles a la bastilla con 2 cm de vuelo por costura.

### Vestido sirena `vestido-sirena`

Corte princesa ajustado hasta la rodilla que se abre en vuelo hacia abajo, como cola de sirena.

**Telas:** Crepé con elastano, satén strech, tejido de punto grueso.

1. Parte del corte princesa desde la sisa.
2. Ajusta las costuras 1 cm hacia adentro a la altura de la rodilla.
3. Desde la rodilla abre 9 cm de vuelo en cada costura y en los costados.
4. Alarga a media pierna y redondea la bastilla de cada panel.

### Vestido corte imperio `vestido-imperio`

Costura justo debajo del busto con falda en A que cae libre sobre la cintura y la cadera.

**Telas:** Gasa, rayón, algodón ligero, chifón con forro.

1. Traza la línea imperio unos 8 cm debajo del punto de busto, en delantero y espalda.
2. Corta el corpiño por esa línea; pasa toda la pinza de busto a la pinza que queda bajo el busto.
3. La falda empieza en la línea imperio: mide la costura del corpiño (con pinzas cerradas) para su ancho de arriba.
4. Abre el costado de la falda lo necesario para pasar la cadera con 8 cm de holgura.
5. Forra el corpiño; cierre al centro espalda.

### Vestido con corte en la cintura `vestido-cintura`

Corpiño ajustado a la cintura con falda de media capa (medio círculo) cosida en la cintura.

**Telas:** Popelina, crepé, rayón, satén.

1. Usa el cuerpo base a la cintura con sus pinzas (busto en el costado).
2. Mide la cintura del corpiño delantero y espalda con las pinzas cerradas.
3. Radio de la falda = cintura total ÷ π (media capa). Reparte el arco entre delantero y espalda.
4. Delantero al doblez en el centro; espalda con costura para el cierre.
5. Forra el corpiño y deja reposar la falda colgada un día antes de emparejar la bastilla.

### Vestido cintura caída `vestido-cintura-caida`

El cuerpo baja recto hasta la cadera alta, donde se cose una falda tableada.

**Telas:** Lino, popelina, crepé de lana.

1. Alarga el cuerpo base hasta 3 cm arriba de la línea de cadera, con pinzas de pez.
2. Corta ahí la costura; mide el contorno del cuerpo en esa línea.
3. La falda es un rectángulo con tablas: cada tabla usa el doble de su ancho visible.
4. Marca dobleces y líneas de colocación; cierre al centro espalda.

### Vestido cruzado `vestido-cruzado`

El delantero cruza de un hombro a la cintura del otro lado y se amarra con lazo. Escote en V.

**Telas:** Punto de rayón, crepé, satén, jersey.

1. Parte del vestido recto (pinza de busto en el costado y pinzas de pez), al doblez en la espalda.
2. Dibuja el delantero completo (las dos mitades).
3. Traza el cruce: del hombro (2.5 cm afuera del cuello) a la cintura del otro lado, 4 cm antes del costado, y de ahí recto a la bastilla.
4. Corta dos delanteros (un par). Del lado que cruza, la pinza de costado queda fuera: ese poco de busto se embebe al coser la cintura.
5. Vista de 6 cm en todo el borde del cruce.
6. Lazos de 85 cm; deja una abertura en un costado para pasar el lazo.

### Vestido camisero `vestido-camisero`

Vestido tipo camisa abotonado al frente, con canesú en la espalda, pie de cuello, manga corta y cinturón.

**Telas:** Popelina, lino, chambray, mezclilla ligera.

1. Parte del vestido suelto con la pinza de busto en el costado.
2. Delantero: agrega 2 cm de cruce y una vista doblada de 6.5 cm; marca botones cada 9 cm sobre el centro.
3. Espalda: corta el canesú 8.5 cm bajo el cuello y cierra la pinza de hombro dentro del canesú.
4. Agrega una tabla encontrada de 8 cm al centro de la espalda.
5. Pie de cuello con el largo del escote más el cruce; manga corta de la manga base; cinturón.

## Tipos de falda

De la falda recta salen todas: cerrando pinzas se da vuelo, con círculos se hacen circulares y con rectángulos tableadas y plisadas.

### Falda recta `falda-recta`

Falda de corte recto desde la cadera, con pinzas, cierre y abertura en el centro espalda y pretina.

**Telas:** Gabardina, lino, mezclilla delgada, crepé grueso.

1. Usa la falda base tal cual: el costado baja recto desde la cadera.
2. Marca la abertura en el centro espalda, 18 cm arriba de la bastilla, y deja 4 cm de margen desde ahí hacia abajo.
3. Pretina: cintura + 2 cm de holgura + 3 cm de traslape, por 8 cm de ancho (doblada a 4 cm).

### Falda lápiz (tubo) `falda-lapiz`

Falda ajustada que se angosta hacia la bastilla. Lleva aletilla en el centro espalda para poder caminar.

**Telas:** Telas con cuerpo y un poco de elasticidad: gabardina stretch, crepé, piqué.

1. Parte de la falda base y mete 2.5 cm el costado en la bastilla (delantero y espalda); une recto con la cadera.
2. En el centro espalda marca 20 cm desde la bastilla y agrega una aletilla de 4 cm con el pico a 45°.
3. Corta la espalda en par: una aletilla queda encima de la otra.

### Falda evasé (línea A) `falda-evase`

Falda que se abre desde la cadera en forma de A. El vuelo sale de cerrar las pinzas de cintura.

**Telas:** Popelina, lino, gabardina ligera, mezclilla delgada.

1. Corta desde la bastilla hasta la punta de cada pinza siguiendo su línea.
2. Cierra la pinza más cercana al costado por completo y la otra a la mitad: la bastilla se abre.
3. Agrega 3 cm de vuelo en el costado, girando desde la cadera para que el costado no cambie de largo.
4. Empareja la bastilla en curva suave, a escuadra con el centro y con el costado.

### Falda circular `falda-circular`

Falda de círculo completo con mucho vuelo y sin pinzas. Se corta en dos medios círculos (o cuatro cuartos si la tela no alcanza).

**Telas:** Telas con caída: crepé, rayón, satén, punto. En telas firmes queda más armada.

1. Radio de cintura = (cintura + 2 cm) ÷ 6.28. Traza un cuarto de círculo con ese radio desde la esquina.
2. Desde la cintura, mide el largo de la falda para trazar la bastilla, paralela a la cintura.
3. Si dos veces (radio + largo) cabe en el ancho de la tela, corta 2 piezas al doblez; si no, 4 cuartos con costuras.
4. Deja colgar la falda 24 horas antes de emparejar la bastilla: el sesgo se estira.

### Falda de media capa (semicircular) `falda-media-capa`

Medio círculo: menos vuelo que la circular y más que la evasé. Una sola pieza al doblez con cierre en el centro espalda.

**Telas:** Crepé, rayón, lino ligero, gabardina ligera.

1. Radio de cintura = (cintura + 2 cm) ÷ 3.14. Traza un cuarto de círculo con ese radio.
2. Mide el largo desde la cintura y traza la bastilla paralela.
3. Corta 1 pieza con un lado al doblez (centro delantero): el otro lado es el centro espalda, con cierre.

### Falda con godets `falda-godets`

Falda recta con seis triángulos de tela (godets) insertados en la parte de abajo: ceñida arriba y con movimiento abajo.

**Telas:** Crepé, rayón, punto firme, lino ligero.

1. Usa la falda base. Marca 30 cm arriba de la bastilla en los costados y en la línea de la primera pinza.
2. En la línea de la pinza corta desde la bastilla hasta la marca: ahí entra un godet.
3. Godet: triángulo con lados de 30 cm y bastilla curva de 26 cm. Cose primero un lado, luego el otro, hasta el piquete.

### Falda tableada (tablones) `falda-tableada`

Falda de rectángulos con tablones encontrados: cajas planas por el derecho que se abren al caminar.

**Telas:** Telas que marcan bien el planchado: gabardina, lana, poliéster, cuadros escoceses.

1. Cada tablón usa 3 veces su ancho: el frente visible y dos dobleces de medio ancho que se juntan por el revés.
2. Divide la mitad de la cintura (+1 cm) entre los tablones de cada panel, de unos 9 cm cada uno.
3. Corta dos rectángulos de 3 × (cintura + 2) ÷ 2 de ancho por el largo de la falda.
4. Dobla cada línea ─·─ y llévala sobre la línea - - - más cercana; hilvana arriba y plancha.

### Falda plisada `falda-plisada`

Falda de rectángulos con pliegues angostos (de unos 4 cm) todos hacia el mismo lado.

**Telas:** Poliéster, gasa de poliéster o telas que guarden el plisado.

1. Cada pliegue usa 3 veces su ancho visible: 1 de frente y 2 que se meten debajo.
2. Divide la mitad de la cintura (+1 cm) entre pliegues de unos 4 cm.
3. Corta dos rectángulos de 3 × (cintura + 2) ÷ 2 por el largo; marca dobleces y colocaciones.
4. Lleva cada línea de doblez sobre la siguiente línea de colocación, siempre hacia el mismo lado, y plancha.

### Falda de nesgas (6 piezas) `falda-nesgas`

Falda armada con paneles verticales (nesgas) que se abren hacia la bastilla. Las pinzas quedan escondidas en las costuras.

**Telas:** Lino, gabardina ligera, crepé, mezclilla delgada.

1. Corta delantero y espalda por la línea de la primera pinza, hasta la bastilla.
2. Junta las dos pinzas en esa costura: la costura entra curva de la cintura a la cadera.
3. Desde la cadera, agrega 6 cm de vuelo a cada lado de cada costura y en los costados.
4. Empareja las bastillas a escuadra con las costuras.

### Falda con canesú y frunces `falda-canesu`

Canesú ajustado a la cadera (sin pinzas) y falda fruncida debajo.

**Telas:** Popelina, batista, lino, rayón.

1. Traza la línea del canesú justo debajo de la punta de las pinzas (unos 10 cm al frente y 15 cm atrás).
2. Corta por esa línea y cierra las pinzas del canesú llevándolas hasta el corte.
3. La falda de abajo es un rectángulo 1.6 veces el ancho del canesú: se frunce hasta medirlo.
4. Corta el canesú doble: una pieza es la vista.

### Falda globo `falda-globo`

Falda abombada: la tela de afuera es más larga y ancha y se frunce arriba y abajo sobre un forro recto más corto.

**Telas:** Tafeta, organza, popelina firme, satén duquesa.

1. Forro: la falda base 4 cm más corta.
2. Falda de afuera: rectángulos 1.8 veces la cadera de ancho y 14 cm más largos que el forro.
3. Frunce la falda de afuera en la cintura y en la bastilla; cose la bastilla de afuera a la del forro para formar el globo.

### Falda tulipán `falda-tulipan`

Dos delanteros que se cruzan con la orilla en curva, como pétalos. Se abre un poco al frente en la bastilla.

**Telas:** Telas con cuerpo: tafeta, gabardina ligera, crepé grueso, satén.

1. Dibuja el delantero completo (las dos mitades).
2. Marca en la cintura un punto pasando el centro, entre las pinzas del otro lado.
3. Traza una curva desde ese punto hasta la bastilla, 15% antes del centro de tu lado.
4. Corta por la curva: es un pétalo. Corta en par y pon vista en la orilla curva.

### Falda sirena `falda-sirena`

Ajustada de la cintura a la rodilla y con mucho vuelo de la rodilla hacia abajo. Hecha de seis nesgas.

**Telas:** Crepé, satén con caída, punto grueso, tafeta para vestir de noche.

1. Alarga la falda base a media pantorrilla y córtala en nesgas por la línea de la primera pinza.
2. Mete 1.5 cm cada costura a la altura de la rodilla para ceñir.
3. Desde la rodilla, abre 12 cm a cada lado de cada costura y en los costados.
4. Empareja las bastillas en curva a escuadra con las costuras.

### Falda cruzada (envolvente) `falda-cruzada`

Falda en A que se envuelve al cuerpo: dos delanteros que se cruzan y se amarran con lazos. Sin cierre.

**Telas:** Lino, rayón, popelina, crepé, mezclilla ligera.

1. Haz la falda evasé y dibuja el delantero completo.
2. Cada delantero pasa del centro hasta después de las pinzas del otro lado (unos 15 cm).
3. La orilla del cruce lleva 3 cm de margen para doblar como vista.
4. Espalda al doblez. Pretina del largo de la cintura más el cruce, y dos lazos de 60 cm.

### Falda escalonada (de olanes) `falda-escalonada`

Tres tiras rectangulares, cada una 1.5 veces más ancha que la de arriba, fruncidas y unidas. Cintura con elástico.

**Telas:** Batista, gasa de algodón, popelina ligera, rayón.

1. Primera tira: 1.25 veces la cadera de ancho; cada tira siguiente es 1.5 veces la anterior.
2. Reparte el largo en 27%, 33% y 40% de arriba hacia abajo.
3. Frunce cada tira y cósela a la de arriba. La cintura es una jareta con elástico de 2.5 cm.

### Falda al bies `falda-al-bies`

Falda en A sin pinzas cortada al sesgo (45°): se pega al cuerpo y cae con movimiento. Cintura con vista.

**Telas:** Satén, crepé de china, charmeuse, rayón, seda.

1. Cierra por completo las dos pinzas de cintura llevándolas a la bastilla y agrega 5 cm de vuelo en el costado.
2. Dibuja el delantero completo; la línea de hilo va a 45° del centro.
3. Vistas de cintura de 5 cm en lugar de pretina; cierre invisible en el centro espalda.
4. Deja colgar 24 h antes de emparejar la bastilla.

## Tipos de pantalón

Del pantalón base se cambian el ancho de la pierna, el largo, el tiro y la cintura.

### Pantalón recto con bragueta `pantalon-recto`

El clásico de vestir: pierna recta, pinzas, pretina con cruce, bragueta con cierre y bolsillos sesgados.

**Telas:** Gabardina, lino, dril, casimir ligero o tencel.

1. Parte del pantalón base al tobillo.
2. Bragueta: vista de 4 cm de ancho por el largo del cierre (18 cm) + 1.5 cm, y pie de bragueta doblado de 3.5 cm.
3. Bolsillo sesgado: marca 4 cm en la cintura desde el costado y 17 cm en el costado; une con una curva suave y recorta la esquina.
4. Costadillo y bolsa siguen el costado hasta 26 cm de fondo; la bolsa llega 12 cm hacia el centro.
5. Pretina en dos mitades unidas en el centro espalda: media cintura terminada + 3.5 cm de cruce, de 4 cm de alto (8 cm doblada).

### Pantalón pitillo (skinny) `pantalon-pitillo`

Ajustado de la cadera al tobillo. Solo funciona en tela con elastano (2 a 5 %), porque casi no lleva holgura.

**Telas:** Mezclilla stretch, gabardina stretch o bengalina (con 2–5 % de elastano).

1. Traza el pantalón base sin holgura en cadera ni cintura: la elasticidad de la tela da la comodidad.
2. Rodilla: contorno de rodilla + 1 cm; bastilla: tobillo + 5 cm (lo justo para que pase el pie).
3. Bragueta, pretina con cruce y bolsillos traseros de parche estilo jean.
4. Prueba en manta con elastano antes de cortar: si la tela estira menos de 2 %, suma 2 cm de holgura en cadera.

### Pantalón palazzo `pantalon-palazzo`

Pierna muy amplia que cae recta desde la cadera hasta el piso, de cintura alta con pretina en curva.

**Telas:** Crepé, rayón, lino, tencel o satín pesado: telas con buena caída.

1. Del pantalón base, baja el costado recto desde la cadera y la entrepierna recta desde el tiro.
2. Abre 6 cm de vuelo en la bastilla en el costado y en la entrepierna.
3. Alarga hasta casi el piso (para usar con tacón).
4. Pretina en curva de 6 cm de alto: la orilla de arriba se abre 1.5 cm por pieza para seguir el cuerpo.

### Pantalón acampanado `pantalon-campana`

Ajustado del muslo a la rodilla y con vuelo desde la rodilla hasta la bastilla.

**Telas:** Mezclilla, gabardina o crepé con algo de elastano.

1. Pantalón base con poca holgura de cadera (3 cm).
2. Cierra la rodilla: contorno de rodilla + 5 cm.
3. Abre la bastilla: rodilla + 19 cm (unos 20 cm más que un recto) y alarga hasta el piso.
4. Une rodilla y bastilla con líneas rectas para que el vuelo empiece en la rodilla.

### Pantalón culotte `pantalon-culotte`

Pantalón amplio a media pantorrilla con piernas en línea A; parece falda al caminar.

**Telas:** Lino, crepé, gabardina ligera o popelina.

1. Del pantalón base, corta a media pantorrilla (rodilla + 14 cm).
2. Baja el costado recto desde la cadera y abre 7 cm en la bastilla.
3. Baja la entrepierna recta desde el tiro y abre 5 cm en la bastilla.
4. Bastilla de 3 cm, pretina con cruce y bragueta.

### Pantalón jogger `pantalon-jogger`

Deportivo de cintura elástica con cordón, pierna que se angosta y puños de punto en el tobillo.

**Telas:** Felpa, french terry, punto grueso o gabardina ligera; puños de resorte (rib).

1. Pantalón base con 8 cm de holgura de cadera para moverse.
2. Quita las pinzas y sube el costado y el centro rectos desde la cadera: la cintura debe pasar por la cadera.
3. Angosta la bastilla a tobillo + 12 cm y acorta 3 cm (el puño completa el largo).
4. Pretina elástica en dos mitades (delantera y trasera) con dos ojales al frente para el cordón.
5. Puños de resorte: 80 % de la bastilla por 7 cm de alto (14 cm doblados).

### Pantalón con pliegues `pantalon-pinzas`

Pantalón de vestir con dos pliegues al frente que dan amplitud en la cadera y caen sobre la raya.

**Telas:** Lino, casimir, gabardina, tencel o crepé.

1. Pantalón base con 6 cm de holgura de cadera; la pinza delantera se deja abierta: se vuelve parte del primer pliegue.
2. Corta por la raya de la cintura a la bastilla y separa 2.5 cm en paralelo (primer pliegue).
3. A 4 cm hacia el costado corta otra vez de la cintura a la bastilla y abre 2.5 cm solo en la cintura (segundo pliegue).
4. Marca los pliegues hacia el costado; la cintura con pliegues cerrados mide lo mismo que la del base.
5. Pretina, bragueta y bolsillos sesgados.

### Pantalón cargo `pantalon-cargo`

Pantalón recto y holgado con bolsillos de parche con fuelle y cartera a los lados de la pierna y bolsillos traseros.

**Telas:** Dril, gabardina, ripstop o lona ligera.

1. Pantalón base con 6 cm de holgura de cadera y pierna un poco más ancha.
2. Marca el bolsillo lateral sobre la costura del costado, 4 cm abajo del tiro: 9 cm hacia el delantero y 9 cm hacia la espalda, por 20 cm de alto.
3. Bolsillo de 22 × 20 cm con un fuelle (pliegue encontrado) de 4 cm al centro; cartera de 19 × 7 cm encima.
4. Bolsillos traseros de parche, bragueta, pretina y bolsillos sesgados al frente.

### Short con vuelta `pantalon-short`

Short de 7 cm de entrepierna con vuelta (valenciana) de 3 cm en la bastilla.

**Telas:** Dril, mezclilla ligera, lino o gabardina.

1. Pantalón base con 5 cm de holgura de cadera; corta a 7 cm abajo del tiro.
2. Costado: baja recto desde la cadera y abre 1 cm en la bastilla.
3. Entrepierna: mete 1.5 cm en el delantero y 3 cm en la espalda para que la pierna no se abra atrás.
4. Bastilla de 7 cm: dobla 1 cm, luego 3 cm, y voltea 3 cm hacia afuera para la vuelta.
5. Pretina, bragueta y bolsillos sesgados (más cortos).

### Bermuda `pantalon-bermuda`

Pantalón corto a la rodilla, de pierna recta y holgada.

**Telas:** Dril, lino, gabardina o mezclilla ligera.

1. Pantalón base con 5 cm de holgura de cadera; corta 2 cm abajo de la línea de rodilla.
2. La bastilla mide el ancho de rodilla del base + 4 cm, repartido a cada lado de la raya (la espalda 1 cm más por lado).
3. Costado y entrepierna rectos de la cadera y del tiro a la bastilla.
4. Bastilla de 4 cm, pretina, bragueta y bolsillos sesgados.

### Pantalón capri (pescador) `pantalon-capri`

Pantalón angosto a media pantorrilla con abertura en el costado.

**Telas:** Gabardina stretch, algodón con elastano o lino.

1. Pantalón base; corta a media pantorrilla (a la mitad entre rodilla y tobillo).
2. Rodilla: contorno de rodilla + 8 cm; bastilla: contorno de rodilla + 2 cm.
3. Deja una abertura de 7 cm en la costura del costado, arriba de la bastilla.
4. Bastilla de 3 cm, pretina y bragueta.

### Pantalón harem (bombacho) `pantalon-harem`

Tiro caído y mucha amplitud en la cadera, fruncido en la cintura elástica y recogido en puños en el tobillo.

**Telas:** Rayón, viscosa, punto de algodón o gasa: telas suaves que se frunzan bien.

1. Pantalón base con 14 cm de holgura de cadera.
2. Quita las pinzas y sube costado y centro rectos: la cintura queda del ancho de cadera y se frunce con elástico.
3. Baja el tiro unos 16 cm y alárgalo 2 cm; traza la curva nueva desde el centro.
4. Une con líneas rectas el tiro caído y la cadera con la bastilla (tobillo + 14 cm de vuelta completa).
5. Puños de tobillo + 5 cm por 4 cm (8 cm doblados) y pretina elástica.

### Pantalón de tiro alto con pretina alta `pantalon-tiro-alto`

Pantalón recto que sube arriba de la cintura con una pretina en curva de 8 cm que sigue la forma del cuerpo.

**Telas:** Gabardina, crepé grueso, lino o mezclilla.

1. Parte del pantalón base (cintura natural).
2. Pretina alta en curva: la orilla de abajo mide la cintura terminada de cada pieza y la de arriba se abre 1.6 cm adelante y 1.2 cm atrás.
3. Se traza como un tramo de cono: radio = cintura × alto ÷ abertura.
4. Corta 4 piezas de cada pretina (exterior y vista) y entretela las exteriores; agrega 3.5 cm de cruce en la del lado izquierdo para la bragueta.
