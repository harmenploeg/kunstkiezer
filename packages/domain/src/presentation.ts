import type { LocatedItem } from "./ranking.ts";
import { validCoordinates } from "./ranking.ts";
import { appHref } from "./navigation.ts";
export const tagHref = (tag: string) =>
  appHref("/agenda?tag=" + encodeURIComponent(tag));
export const detailHref = (item: { id: string; category: string }) =>
  appHref(
    "/bekijk?categorie=" +
      encodeURIComponent(item.category) +
      "&id=" +
      encodeURIComponent(item.id),
  );
export function subjectKind(item: {
  category: string;
  tags: string[];
}): string {
  if (item.category === "musea") {
    for (const [tag, label] of [
      ["fotografie", "Fotografiemuseum"],
      ["kunsthal", "Kunsthal"],
      ["kunstenaarsmuseum", "Kunstenaarsmuseum"],
      ["moderne kunst", "Museum voor moderne kunst"],
      ["hedendaagse kunst", "Museum voor hedendaagse kunst"],
      ["keramiek", "Keramiekmuseum"],
      ["design", "Designmuseum"],
    ] as const)
      if (item.tags.includes(tag)) return label;
    return "Kunstmuseum";
  }
  return (
    (
      {
        "openbare-kunst": "Kunst in de openbare ruimte",
        beeldenparken: "Beeldentuin / beeldenpark",
        architectuur: "Architectuur",
        evenementen: "Tentoonstelling / evenement",
      } as Record<string, string>
    )[item.category] ?? "Kunst"
  );
}
// Keep editorial instructions out of visitor copy; factual access information remains.
export function visitorText(text: string): string {
  return text
    .split(/(?<=[.!?])\s+|\n+/u)
    .filter(
      (s) =>
        !/nog (?:te |niet |redactioneel )?(?:bevestig|control)|control(?:eer|eren)|raadpleeg|redaction|automatisch|bronvermelding is geen|locatie.*schatting/i.test(
          s,
        ),
    )
    .join(" ")
    .trim();
}
export function precisePoint(r: LocatedItem): boolean {
  return (
    validCoordinates(r) &&
    (!r.coordinate_precision ||
      ["exact", "address", "street"].includes(r.coordinate_precision))
  );
}
export function directionsUrl(
  r: LocatedItem & { name: string; street_address: string; city: string },
  mode: string,
): string {
  const destination = precisePoint(r)
    ? `${r.latitude},${r.longitude}`
    : [r.name, r.street_address, r.city, "Nederland"]
        .filter(Boolean)
        .join(", ");
  return (
    "https://www.google.com/maps/dir/?" +
    new URLSearchParams({ api: "1", destination, travelmode: mode }).toString()
  );
}
