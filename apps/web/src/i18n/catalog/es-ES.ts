import type { PartialCatalog } from "./en";

/** Español (España) — overrides vs the neutral Latin-American base. */
const esES: PartialCatalog = {
  "early.bannerText":
    "Ahora mismo todas las cuentas tienen acceso completo sin coste. Los planes y límites se introducirán más adelante, con aviso antes de cualquier cambio.",
  "auth.loginSubtitle": "Bienvenido de nuevo a oops.",
  "auth.inviteOnlyBody": "Estamos abriendo poco a poco. Mantente al tanto: pronto habrá plazas.",
  "billing.notConfigured":
    "La facturación todavía no está configurada (falta VITE_REVENUECAT_PUBLIC_KEY). Añade tu clave pública de RevenueCat Web Billing a .env y vuelve a construir la imagen web.",
};
export default esES;
