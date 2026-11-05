# Generador de patrones (patronaje digital)

Sistema de patronaje paramétrico: a partir de las medidas traza los **patrones base** (cuerpo, manga,
falda y pantalón) y de ahí cada **transformación**: tipos de escote, cuello, manga, pinza, cortes de
vestido, faldas y pantalones. Entrega archivos listos para AutoCAD y para imprimir:

| Archivo | Para qué |
|---|---|
| `modelo.dxf` | AutoCAD (R12, milímetros, escala 1:1). Una capa por talla (`TALLA-XS` … `TALLA-4XL`) e `INFO` con nombres e hilo. Con una sola talla agrega la capa `COSTURA` (línea punteada). |
| `modelo-plotter.pdf` | PDF a escala real del ancho de un rollo de plotter (91.4 cm), con una capa por talla para apagar las que no se usan en Acrobat Reader. |
| `modelo-carta.pdf`, `modelo-a4.pdf` | Con `--hojas`: el mismo patrón partido en hojas para imprimir en casa (portada, cuadro de prueba, rombos de unión, capas conservadas). |
| `modelo.svg` | Con `--svg`: vista previa rápida en talla M. |

Las piezas traen **margen de costura** (1 cm; 2–3 cm en bastillas; 0 en dobleces), pinzas con su
punto final, piquetes de unión (1 delantero, 2 espalda), línea de hilo, doblez de tela y texto de corte.

## Uso

Desde la carpeta `tienda-patrones/` (Node 22.18 o más nuevo):

```bash
npm run patron -- lista                          # todos los modelos disponibles
npm run patron -- escote-v                       # tallas XS a 4XL anidadas
npm run patron -- escote-v --talla M             # una talla, con línea de costura
npm run patron -- falda-circular --tallas S,M,L  # algunas tallas
npm run patron -- vestido-princesa-hombro --hojas --svg
npm run patron -- pantalon-recto --medidas patronaje/medidas-ejemplo.json   # a la medida
npm run patron -- todos --salida biblioteca/     # toda la biblioteca
npm run patron -- catalogo                       # actualiza CATALOGO.md
```

Los archivos quedan en `patrones-generados/<modelo>/` (o en la carpeta de `--salida`).

### Patrones a la medida

Copia `medidas-ejemplo.json`, pon las medidas de tu clienta en centímetros y genera con `--medidas`.
Solo son obligatorias **busto, cintura y cadera**; lo que falte se calcula con proporciones (y la
estatura ajusta los largos). Medidas que puedes dar:

`estatura, busto, cintura, cadera, talleEspalda, cuello, anchoEspalda, anchoPecho, hombro,
separacionBusto, alturaCadera, largoBrazo, brazo, muneca, tiro, largoPierna, rodilla, tobillo, largoRodilla`

## Cómo está hecho el sistema

- **Tabla de tallas** (`medidas.ts`): XS a 4XL para estatura de 1.60 m. Busto, cintura y cadera son
  los de la tabla publicada en la tienda; las demás medidas son proporcionales.
- **Cuerpo base** (`bases/cuerpo.ts`): 10 cm de holgura en busto y 4 en cintura. El delantero se sube
  (busto/5 + 8.3 cm sobre la línea de busto) para dar el largo que pide el busto, y la pinza de busto se
  abre con ángulo (busto/4 − 2.5)° hacia el punto de busto. Así funciona para cualquier tamaño de busto.
- **Manga** (`bases/manga.ts`): la altura de copa se calcula para que la copa mida exactamente la sisa
  más 2.5 cm de embebido.
- **Falda** y **pantalón**: 4 cm de holgura en cadera y 2 cm en cintura.
- Las pruebas (`npm test`) revisan en todas las tallas que costados, hombros, cinturas y copa/sisa coincidan.

> **Importante:** como todo sistema de patronaje, es un punto de partida. Antes de vender un modelo,
> cose una prueba en manta (o tela barata) en por lo menos dos tallas y ajusta.

## Agregar o cambiar modelos

Cada categoría vive en `modelos/<categoria>.ts`. Un modelo es:

```ts
{
  id: "escote-v",
  categoria: "escotes",
  nombre: "Escote en V",
  descripcion: "Qué es y cuándo se usa.",
  pasos: ["Paso 1 del trazo…", "Paso 2…"],
  generar: (m) => [espalda, delantero, vista],   // piezas para la talla m
}
```

Herramientas de transformación (`pieza.ts`), las mismas que se usan a mano en la mesa:

| Función | Equivale a |
|---|---|
| `trasladarPinza(pieza, ápice, destino)` | Cortar hasta el punto de busto y girar para mover la pinza (también parcial, para pinzas dobles). |
| `abrir(pieza, desde, bisagra, cm)` | Cortar y separar para dar vuelo (o `{ paralelo: true }` para frunces). |
| `dividir(pieza, a, b, línea)` | Cortar una pieza en dos (canesú, cortes princesa, imperio). |
| `unir(p1, …, p2, …)` | Juntar dos piezas por una costura (quitar un corte). |
| `completar(pieza, a, b)` | Reflejar sobre el doblez para tener la pieza completa (asimétricos). |
| `suavizar(pieza, a, b)` | Emparejar una curva después de abrir. |
| `vista(pieza, a, b, ancho)` | Sacar una vista (escote, sisa, cintura). |
| `margen`, `doblez`, `piquete` | Márgenes, doblez de tela y piquetes. |
