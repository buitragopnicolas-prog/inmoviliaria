/** Repeated paragraphs keep distinct keys when unrelated paragraphs are edited. */
export function keyedParagraphs(parts: string[]) {
  const occurrences = new Map<string, number>();
  return parts.map(text => {
    const occurrence = (occurrences.get(text) ?? 0) + 1;
    occurrences.set(text, occurrence);
    return { text, key: JSON.stringify([text, occurrence]) };
  });
}
