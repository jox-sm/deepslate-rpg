export function filterEntriesWithImages<T extends { image: string }>(entries: T[]): T[] {
  return entries.filter(entry => entry.image && entry.image.length > 0);
}
