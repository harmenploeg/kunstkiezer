import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CatalogItem } from "../../../../../packages/data/src/catalog.ts";
import {
  detailHref,
  precisePoint,
} from "../../../../../packages/domain/src/presentation.ts";
export function CatalogMap({
  items,
  compact = false,
}: {
  items: CatalogItem[];
  compact?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const map = L.map(root.current, {
      scrollWheelZoom: false,
      doubleClickZoom: false,
    }).setView([52.1, 5.2], 7);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const groups = new Map<string, CatalogItem[]>();
    for (const item of items.filter(precisePoint)) {
      const key = item.latitude + "," + item.longitude;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    const bounds: L.LatLngExpression[] = [];
    for (const rows of groups.values()) {
      const first = rows[0]!;
      const point: L.LatLngExpression = [first.latitude!, first.longitude!];
      bounds.push(point);
      const dot = L.circleMarker(point, {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: "#db163e",
        fillOpacity: 0.95,
        bubblingMouseEvents: false,
      }).addTo(map);
      const name = document.createElement("span");
      name.textContent = rows.map((r) => r.name).join(" · ");
      dot.bindTooltip(name);
      const popup = document.createElement("div");
      for (const row of rows) {
        const a = document.createElement("a");
        a.href = detailHref(row);
        a.textContent = row.name + " →";
        a.style.display = "block";
        popup.append(a);
      }
      dot.bindPopup(popup);
      dot.on("dblclick", () => {
        if (rows.length === 1) window.location.assign(detailHref(first));
        else dot.openPopup();
      });
      const el = dot.getElement();
      if (el) {
        el.setAttribute("tabindex", "0");
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", rows.map((r) => r.name).join(", "));
        el.addEventListener("keydown", (e) => {
          const key = (e as KeyboardEvent).key;
          if (key === "Enter" || key === " ") {
            e.preventDefault();
            dot.openPopup();
          }
        });
      }
    }
    if (bounds.length)
      map.fitBounds(L.latLngBounds(bounds), {
        padding: [30, 30],
        maxZoom: compact ? 15 : 13,
      });
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(root.current);
    return () => {
      observer.disconnect();
      map.remove();
    };
  }, [items, compact]);
  return (
    <div
      ref={root}
      className={"catalog-map" + (compact ? " compact" : "")}
      aria-label="Kaart met kunstlocaties"
    />
  );
}
