export function generarMosaico(o: {
  entrada: string;
  papel: "carta" | "a4";
  nombre?: string;
  tienda?: string;
  margen?: number;
  salida?: string;
  silencioso?: boolean;
}): Promise<string>;
