import type { PartialCatalog } from "./en";

/** Español (España) — overrides vs the neutral Latin-American base. */
const esES: PartialCatalog = {
  "landing.seeWhoBody": "Ordenador, móvil o tableta; navegador y sistema operativo; tamaño de pantalla e idioma.",
  "early.bannerText":
    "Ahora mismo todas las cuentas tienen acceso completo sin coste. Los planes y límites se introducirán más adelante, con aviso antes de cualquier cambio.",
  "docs.trackerBody":
    "Un script sin dependencias de menos de 3 KB servido desde este host. Añádelo una vez en tu layout; envía un hit por vista de página y por cambio de ruta de la SPA, sin cookies y sin guardar nada en el navegador.",
  "device.desktop": "Ordenador",
  "device.tablet": "Tableta",
  "auth.loginSubtitle": "Bienvenido de nuevo a oops.",
  "auth.inviteOnlyBody": "Estamos abriendo poco a poco. Mantente al tanto: pronto habrá plazas.",
  "dash.usageEventsHint": "Vistas de página + eventos personalizados recibidos este mes natural.",
  "psettings.installBody": "Añade el script a tu layout, pon un pixel donde no se ejecute JavaScript o envía un POST a la API de recolección desde tu backend.",
  "psettings.snippetPixelHint": "Para correos y READMEs. u es la página o cosa que quieres contar; añade n=open para un evento con nombre. Detalles:",
  "billing.notConfigured":
    "La facturación todavía no está configurada (falta VITE_REVENUECAT_PUBLIC_KEY). Añade tu clave pública de RevenueCat Web Billing a .env y vuelve a construir la imagen web.",
};
export default esES;
