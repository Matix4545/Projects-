export type Proveedor = "mp" | "stripe" | "demo";

export type ResultadoPago =
  | { estado: "invalido" }
  | {
      estado: "aprobado" | "pendiente" | "rechazado";
      id: string;
      referencia: string | null;
      correo: string | null;
      total: number | null;
      moneda: string | null;
      /** Liga permanente a la página de descargas de este pago */
      liga: string;
    };
