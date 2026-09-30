/**
 * 16.1 — Ice Breaker : idées de premier message, gratuites pour tous. Chaque idée peut
 * utiliser le prénom et un centre d'intérêt de la personne (remplis sur son profil).
 */
export interface IceBreakerContext {
  firstName: string;
  interest: string | null;
}

const WITH_INTEREST: ((c: IceBreakerContext) => string)[] = [
  (c) =>
    `Bonjour ${c.firstName} ! J'ai vu que vous aimez « ${c.interest} ». Qu'est-ce qui vous plaît le plus là-dedans ?`,
  (c) =>
    `Bonsoir ${c.firstName}, « ${c.interest} » m'a intrigué sur votre profil. Depuis quand est-ce une passion pour vous ?`,
];

const STANDARD: ((c: IceBreakerContext) => string)[] = [
  (c) =>
    `Bonjour ${c.firstName} ! Votre profil m'a touché. Qu'est-ce qui compte le plus pour vous dans une relation ?`,
  (c) => `Bonjour ${c.firstName}, quel est le verset biblique qui vous accompagne en ce moment ?`,
  (c) => `Bonjour ${c.firstName} ! Comment se passe la vie dans votre église en ce moment ?`,
  (c) => `Bonsoir ${c.firstName}, qu'est-ce qui vous fait sourire dans une journée ordinaire ?`,
  (c) =>
    `Bonjour ${c.firstName} ! Si vous deviez décrire votre foi en trois mots, lesquels choisiriez-vous ?`,
  (c) => `Bonjour ${c.firstName}, quel est votre chant de louange préféré ?`,
  (c) => `Bonjour ${c.firstName} ! À quoi ressemble un dimanche idéal pour vous ?`,
  (c) => `Bonsoir ${c.firstName}, quel projet vous tient le plus à cœur cette année ?`,
  (c) =>
    `Bonjour ${c.firstName} ! Quelle qualité appréciez-vous le plus chez les personnes qui vous entourent ?`,
  (c) => `Bonjour ${c.firstName}, qu'est-ce qui vous a donné envie de rejoindre YONA ?`,
];

/** Toutes les idées pour cette personne (celles liées à ses intérêts en premier). */
export function iceBreakerSuggestions(context: IceBreakerContext): string[] {
  const first = context.interest ? WITH_INTEREST.map((f) => f(context)) : [];
  return [...first, ...STANDARD.map((f) => f(context))];
}

/** Nombre d'idées affichées à la fois. */
export const ICE_BREAKER_PAGE = 3;
