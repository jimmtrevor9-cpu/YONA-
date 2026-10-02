/**
 * Informations légales de YONA (pages légales et pied de page).
 * Les champs vides ne s'affichent pas : il suffit de les remplir ici pour qu'ils
 * apparaissent sur le site.
 */
export const LEGAL = {
  brand: "YONA",
  /** Forme juridique (ex. « SARL »). À compléter. */
  legalForm: "",
  /** Numéro d'immatriculation (RCCM) et, si besoin, numéro d'identification fiscale (NIF). */
  registration: "",
  headOffice: "Libreville, Gabon",
  phoneDisplay: "074 77 42 66",
  phoneHref: "tel:074774266",
  email: "angeboussamba12@gmail.com",
  publicationDirector: "L'équipe YONA",
  /** Date de dernière mise à jour des pages légales. */
  updatedAt: "2 octobre 2026",
} as const;

export const LEGAL_LINKS = [
  { to: "/confidentialite", label: "Politique de confidentialité" },
  { to: "/cgu", label: "Conditions d'utilisation" },
  { to: "/mentions-legales", label: "Mentions légales" },
  { to: "/cookies", label: "Politique des cookies" },
] as const;
