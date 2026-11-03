import assert from "node:assert/strict";
import { test } from "node:test";
import { dispositivoDe, esBot, limpiarRuta, origenDe, rutaContable, visitanteDelDia, zonaDeGeo } from "../lib/estadisticas.ts";

test("zona de la visita", () => {
  const mx = { country: { code: "MX" } };
  assert.equal(zonaDeGeo({ ...mx, city: "Ciudad Obregón", subdivision: { code: "SON" } }), "obregon");
  assert.equal(zonaDeGeo({ ...mx, city: "Hermosillo", subdivision: { code: "SON" } }), "sonora");
  assert.equal(zonaDeGeo({ ...mx, city: "Monterrey", subdivision: { code: "NLE" } }), "mexico");
  assert.equal(zonaDeGeo({ country: { code: "US" } }), "extranjero");
  assert.equal(zonaDeGeo(null), "desconocida");
});

test("origen, dispositivo y robots", () => {
  assert.equal(origenDe("https://www.google.com/", "chambaradar.com"), "google");
  assert.equal(origenDe("https://l.facebook.com/l.php?u=x", "chambaradar.com"), "facebook");
  assert.equal(origenDe("https://chambaradar.com/vacantes", "chambaradar.com"), "interno");
  assert.equal(origenDe("", "chambaradar.com"), "directo");
  assert.equal(dispositivoDe("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"), "movil");
  assert.equal(dispositivoDe("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "escritorio");
  assert.equal(esBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(esBot("WhatsApp/2.23"), true);
  assert.equal(esBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"), false);
});

test("la ruta guarda solo área y lugar; la búsqueda va aparte", () => {
  assert.deepEqual(limpiarRuta("/vacantes?categoria=ventas&donde=remoto&pagina=3&correo=a@b.com"), { ruta: "/vacantes?categoria=ventas&donde=remoto", busqueda: null });
  assert.deepEqual(limpiarRuta("/vacantes?q=  Auxiliar   CONTABLE "), { ruta: "/vacantes", busqueda: "auxiliar contable" });
  assert.equal(rutaContable("/panel"), false);
  assert.equal(rutaContable("/cuenta?pago=ok"), false);
  assert.equal(rutaContable("/vacantes"), true);
});

test("el código del visitante cambia cada día", async () => {
  const a = await visitanteDelDia("1.2.3.4", "ua", "2026-11-03", "sal");
  assert.equal(a, await visitanteDelDia("1.2.3.4", "ua", "2026-11-03", "sal"));
  assert.notEqual(a, await visitanteDelDia("1.2.3.4", "ua", "2026-11-04", "sal"));
  assert.equal(a.length, 16);
});
