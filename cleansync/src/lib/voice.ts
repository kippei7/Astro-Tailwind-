import type { Area } from "./types";

export function normalizeUtterance(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　、。・]/g, "")
    .replace(/[をはがにで]$/g, "");
}

export function findAreaByUtterance(
  areas: Area[],
  utterance: string,
): Area | null {
  const query = normalizeUtterance(utterance);
  if (!query) return null;

  const exact = areas.find((area) => normalizeUtterance(area.name) === query);
  if (exact) return exact;

  const partial = areas.filter((area) => {
    const name = normalizeUtterance(area.name);
    return name.includes(query) || query.includes(name);
  });

  if (partial.length === 0) return null;
  return [...partial].sort(
    (a, b) => normalizeUtterance(b.name).length - normalizeUtterance(a.name).length,
  )[0];
}
