/** « 1 visiteur », « 3 visiteurs ». */
export function visitorsCountLabel(count: number): string {
  return count > 1 ? `${count} visiteurs` : `${count} visiteur`;
}

/** « 1 visite », « 4 visites ». */
export function visitCountLabel(count: number): string {
  return count > 1 ? `${count} visites` : `${count} visite`;
}
