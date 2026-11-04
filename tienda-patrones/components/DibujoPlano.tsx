// Dibujos planos (vista de frente) de cada prenda, en SVG.
// Sirven como imagen mientras no tengas fotos. Para agregar uno nuevo, crea una
// entrada en DIBUJOS y ponle esa clave al patrón en lib/catalogo.ts (campo `dibujo`).

type Props = { dibujo: string; className?: string; titulo?: string };

const T = { fill: "var(--lienzo)", stroke: "var(--tinta)", strokeWidth: 1.8, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const L = { fill: "none", stroke: "var(--tinta)", strokeWidth: 1.2, strokeLinecap: "round" as const };
const P = { fill: "none", stroke: "var(--tinta)", strokeWidth: 0.9, strokeDasharray: "3 2.5", opacity: 0.8 }; // pespunte

const DIBUJOS: Record<string, React.ReactNode> = {
  "vestido-cruzado": (
    <>
      {/* falda */}
      <path {...T} d="M72 112 L36 216 Q100 232 164 216 L128 112 Z" />
      <path {...L} d="M122 113 Q132 170 146 222" />
      <path {...L} d="M92 120 Q86 168 74 224" opacity={0.5} />
      <path {...L} d="M108 120 Q112 170 118 228" opacity={0.5} />
      {/* mangas */}
      <path {...T} d="M60 36 L36 66 L50 75 L66 66 Z" />
      <path {...T} d="M140 36 L164 66 L150 75 L134 66 Z" />
      <path {...L} d="M40 61 L54 70 M160 61 L146 70" />
      {/* cuerpo */}
      <path {...T} d="M82 28 Q100 36 118 28 L140 36 L134 66 L128 108 L72 108 L66 66 L60 36 Z" />
      <path {...L} d="M118 28 Q108 56 98 76" opacity={0.6} />
      <path {...L} d="M82 28 Q100 70 124 108" />
      <path {...P} d="M85 31 Q102 70 126 105" />
      {/* lazo */}
      <path {...T} d="M71 106 L129 106 L129 114 L71 114 Z" />
      <path {...T} d="M76 114 Q70 136 60 152 L66 155 Q76 140 81 114 Z" />
      <path {...T} d="M82 114 Q82 138 78 158 L85 158 Q88 138 87 114 Z" />
    </>
  ),
  "blusa-globo": (
    <>
      <path {...T} d="M66 66 L64 156 Q100 162 136 156 L134 66 Z" />
      <path {...T} d="M62 38 C38 34 24 66 36 88 L52 92 C58 82 66 74 66 66 Z" />
      <path {...T} d="M138 38 C162 34 176 66 164 88 L148 92 C142 82 134 74 134 66 Z" />
      <path {...L} d="M36 84 L52 89 M164 84 L148 89" />
      <path {...L} d="M44 40 L46 46 M50 38 L51 44 M56 38 L56 44 M156 40 L154 46 M150 38 L149 44 M144 38 L144 44" opacity={0.6} />
      <path {...T} d="M84 30 Q100 46 116 30 L138 38 L134 66 L66 66 L62 38 Z" />
      <path {...P} d="M87 33 Q100 46 113 33" />
      <path {...P} d="M66 150 Q100 156 134 150" />
      <path {...L} d="M84 90 Q86 120 82 150 M116 90 Q114 120 118 150" opacity={0.35} />
    </>
  ),
  "falda-vuelo": (
    <>
      <path {...T} d="M70 54 L34 202 Q100 220 166 202 L130 54 Z" />
      <path {...L} d="M86 60 Q78 130 64 210 M100 60 L100 214 M114 60 Q122 130 136 210" opacity={0.45} />
      <path {...P} d="M38 196 Q100 213 162 196" />
      <path {...L} d="M72 66 Q66 84 70 98" opacity={0.7} />
      <path {...L} d="M128 66 Q134 84 130 98" opacity={0.7} />
      <rect {...T} x={68} y={38} width={64} height={16} rx={2} />
      <path {...L} d="M76 40 L76 52 M84 40 L84 52 M92 40 L92 52 M100 40 L100 52 M108 40 L108 52 M116 40 L116 52 M124 40 L124 52" opacity={0.4} />
    </>
  ),
  "pantalon-palazzo": (
    <>
      <path {...T} d="M68 42 L38 222 L96 222 L100 100 L104 222 L162 222 L132 42 Z" />
      <path {...L} d="M100 42 L100 100" />
      <path {...P} d="M96 44 Q98 70 100 92" />
      <path {...L} d="M84 44 L85 70 M116 44 L115 70" />
      <path {...L} d="M73 44 L82 72 M127 44 L118 72" />
      <path {...L} d="M70 140 Q66 180 56 220 M130 140 Q134 180 144 220" opacity={0.4} />
      <rect {...T} x={66} y={28} width={68} height={14} rx={2} />
      <path {...P} d="M42 214 L96 214 M104 214 L158 214" />
    </>
  ),
  overol: (
    <>
      <path {...T} d="M66 98 L62 224 L97 224 L100 140 L103 224 L138 224 L134 98 Z" />
      <path {...L} d="M100 98 L100 140" />
      <path {...P} d="M95 100 Q96 124 100 136" />
      <path {...T} d="M70 112 L88 112 L88 132 Q79 138 70 132 Z" />
      <path {...T} d="M130 112 L112 112 L112 132 Q121 138 130 132 Z" />
      <path {...P} d="M66 216 L97 216 M103 216 L138 216" />
      {/* tirantes */}
      <path {...T} d="M78 14 L84 14 L86 42 L80 42 Z" />
      <path {...T} d="M122 14 L116 14 L114 42 L120 42 Z" />
      {/* peto */}
      <path {...T} d="M78 40 L122 40 L124 90 L76 90 Z" />
      <rect {...T} x={88} y={52} width={24} height={20} rx={1} />
      <path {...P} d="M81 43 L119 43 M90 55 L110 55" />
      <rect {...T} x={77} y={38} width={10} height={8} rx={1.5} />
      <rect {...T} x={113} y={38} width={10} height={8} rx={1.5} />
      <rect {...T} x={64} y={88} width={72} height={10} rx={2} />
      <circle {...T} cx={70} cy={93} r={2} />
      <circle {...T} cx={130} cy={93} r={2} />
    </>
  ),
  playera: (
    <>
      <path {...T} d="M60 38 L34 72 L50 81 L64 64 Z" />
      <path {...T} d="M140 38 L166 72 L150 81 L136 64 Z" />
      <path {...P} d="M38 67 L53 76 M162 67 L147 76" />
      <path {...T} d="M86 28 Q100 42 114 28 L140 38 L136 64 L136 170 Q100 174 64 170 L64 64 L60 38 Z" />
      <path {...L} d="M82 30 Q100 50 118 30" />
      <path {...P} d="M64 163 Q100 167 136 163" />
    </>
  ),
  "vestido-nina": (
    <>
      <path {...T} d="M72 84 L40 196 Q50 202 58 196 Q70 204 80 197 Q92 205 100 198 Q110 205 120 197 Q130 204 142 196 Q150 202 160 196 L128 84 Z" />
      <path {...L} d="M80 88 L78 96 M88 88 L87 96 M96 88 L96 96 M104 88 L104 96 M112 88 L113 96 M120 88 L122 96" opacity={0.6} />
      <path {...L} d="M84 100 Q76 150 66 198 M116 100 Q124 150 134 198" opacity={0.4} />
      <path {...T} d="M70 48 C54 50 44 66 50 78 Q56 72 60 79 Q64 72 70 78 Z" />
      <path {...T} d="M130 48 C146 50 156 66 150 78 Q144 72 140 79 Q136 72 130 78 Z" />
      <path {...T} d="M88 40 Q100 54 112 40 L130 48 L128 84 L72 84 L70 48 Z" />
      <path {...P} d="M91 43 Q100 54 109 43" />
      <path {...P} d="M73 80 L127 80" />
      <path {...T} d="M100 84 L92 78 L92 90 Z M100 84 L108 78 L108 90 Z" />
    </>
  ),
  kimono: (
    <>
      <path {...T} d="M80 26 L28 42 L26 104 L62 104 L62 204 L138 204 L138 104 L174 104 L172 42 L120 26 Q100 34 80 26 Z" />
      <path {...L} d="M66 31 L63 104 M134 31 L137 104" opacity={0.7} />
      <path {...P} d="M30 98 L60 98 M170 98 L140 98" />
      <path {...T} d="M80 26 L92 204 L99 204 L88 30 Z" />
      <path {...T} d="M120 26 L108 204 L101 204 L112 30 Z" />
      <path {...T} d="M80 26 Q100 34 120 26 L112 30 Q100 37 88 30 Z" />
      <path {...L} d="M76 140 Q74 170 70 200 M124 140 Q126 170 130 200" opacity={0.35} />
    </>
  ),
};

export function DibujoPlano({ dibujo, className, titulo }: Props) {
  return (
    <svg viewBox="0 0 200 240" className={className} role="img" aria-label={titulo ?? "Dibujo plano de la prenda"}>
      {DIBUJOS[dibujo] ?? DIBUJOS["playera"]}
    </svg>
  );
}
