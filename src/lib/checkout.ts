export const CHECKOUT_COUNTRIES = [
  { name: "Nigeria", currency: "NGN", locale: "en-NG", dialCode: "+234", phonePlaceholder: "801 234 5678" },
  { name: "United States", currency: "USD", locale: "en-US", dialCode: "+1", phonePlaceholder: "(201) 555-0123" },
  { name: "United Kingdom", currency: "GBP", locale: "en-GB", dialCode: "+44", phonePlaceholder: "7123 456789" },
  { name: "Canada", currency: "CAD", locale: "en-CA", dialCode: "+1", phonePlaceholder: "(416) 555-0123" },
  { name: "Germany", currency: "EUR", locale: "de-DE", dialCode: "+49", phonePlaceholder: "1512 3456789" },
  { name: "France", currency: "EUR", locale: "fr-FR", dialCode: "+33", phonePlaceholder: "6 12 34 56 78" },
  { name: "Netherlands", currency: "EUR", locale: "nl-NL", dialCode: "+31", phonePlaceholder: "6 12345678" },
] as const;

export type CheckoutCountry = (typeof CHECKOUT_COUNTRIES)[number]["name"];

export function detectCheckoutCountry(): CheckoutCountry {
  if (typeof navigator === "undefined") return "United States";

  const locale = navigator.language || "en-US";
  const region = locale.split("-")[1]?.toUpperCase();

  if (region === "NG") return "Nigeria";
  if (region === "GB") return "United Kingdom";
  if (region === "CA") return "Canada";
  if (region === "DE") return "Germany";
  if (region === "FR") return "France";
  if (region === "NL") return "Netherlands";
  return "United States";
}

export function getCheckoutCountryMeta(country: CheckoutCountry) {
  return CHECKOUT_COUNTRIES.find((item) => item.name === country) ?? CHECKOUT_COUNTRIES[1];
}

export function formatCheckoutPhone(country: CheckoutCountry, phone: string) {
  const normalized = phone.trim();
  if (!normalized) return "";
  if (normalized.startsWith("+")) return normalized;
  return `${getCheckoutCountryMeta(country).dialCode} ${normalized}`;
}
