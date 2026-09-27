/** « 1 profil en favori », « 3 profils en favori ». */
export function favoritesCountLabel(count: number): string {
  return count > 1 ? `${count} profils en favori` : `${count} profil en favori`;
}
