/** « 1 profil en favori », « 3 profils en favori ». */
export function favoritesCountLabel(count: number): string {
  return count > 1 ? `${count} profils en favori` : `${count} profil en favori`;
}

/** « 1 favori n'est plus disponible pour le moment. », au pluriel au-delà de 1. */
export function unavailableFavoritesLabel(count: number): string {
  return count > 1
    ? `${count} favoris ne sont plus disponibles pour le moment.`
    : `${count} favori n'est plus disponible pour le moment.`;
}

/** « 1 membre vous a mis en favori », « 3 membres vous ont mis en favori ». */
export function favoritedByCountLabel(count: number): string {
  return count > 1
    ? `${count} membres vous ont mis en favori`
    : `${count} membre vous a mis en favori`;
}
