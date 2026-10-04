import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { voyagerUrl } from "./basemap.ts";
import { useMapLocation } from "./useMapLocation.ts";
import "leaflet/dist/leaflet.css";
import type { CatalogItem } from "../../../../../packages/data/src/catalog.ts";
import {
  detailHref,
  precisePoint,
} from "../../../../../packages/domain/src/presentation.ts";
export function CatalogMap({
  items,
  compact = false,
  focusOnOpen = false,
}: {
  items: CatalogItem[];
  compact?: boolean;
  focusOnOpen?: boolean;
}) {
  const location = useMapLocation(!compact);
  const latitude = compact ? undefined : location?.latitude;
  const longitude = compact ? undefined : location?.longitude;
  const root = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!focusOnOpen || !root.current) return;
    root.current.focus({ preventScroll: true });
    root.current.scrollIntoView({ block: "start" });
  }, [focusOnOpen]);
  useEffect(() => {
    if (!root.current) return;
    const map = L.map(root.current, {
      scrollWheelZoom: false,
      doubleClickZoom: false,
      zoomSnap: 0,
    }).setView([52.1, 5.2], 7);
    setTileError(false);
    let loaded = false;
    let active = true;
    void voyagerUrl()
      .then((url) => {
        if (!active) return;
        const tiles = L.tileLayer(url, {
          maxZoom: 20,
          subdomains: "abcd",
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
        });
        tiles.on("tileload", () => {
          loaded = true;
          setTileError(false);
        });
        tiles.on("tileerror", () => {
          if (!loaded) setTileError(true);
        });
        tiles.addTo(map);
      })
      .catch(() => {
        if (active) setTileError(true);
      });
    const timeout = window.setTimeout(() => {
      if (!loaded) setTileError(true);
    }, 12000);
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
    if (latitude !== undefined && longitude !== undefined) {
      const here = L.latLng(latitude, longitude);
      map.fitBounds(here.toBounds(50000), { padding: [0, 0], animate: false });
      const label = document.createElement("span");
      label.textContent = "Jouw locatie";
      L.circleMarker(here, {
        radius: 7,
        color: "#fff",
        weight: 2,
        fillColor: "#2563eb",
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip(label);
      L.control.scale({ imperial: false }).addTo(map);
    } else if (bounds.length)
      map.fitBounds(L.latLngBounds(bounds), {
        padding: [30, 30],
        animate: false,
        maxZoom: compact ? 15 : 13,
      });
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(root.current);
    return () => {
      active = false;
      window.clearTimeout(timeout);
      observer.disconnect();
      map.remove();
    };
  }, [items, compact, attempt, latitude, longitude]);
  return (
    <div className="map-frame">
      {tileError && (
        <p role="status" className="notice">
          De achtergrondkaart kon niet laden. Je kunt de stippen nog openen.{" "}
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Kaart opnieuw laden
          </button>
        </p>
      )}
      <div
        ref={root}
        role="region"
        tabIndex={-1}
        className={"catalog-map" + (compact ? " compact" : "")}
        aria-label="Kaart met kunstlocaties"
      />
    </div>
  );
}
