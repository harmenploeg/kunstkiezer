// Reuse Loci's existing browser basemap configuration; never bundle its key.
let pending: Promise<string> | null = null;
export function voyagerUrl(): Promise<string> {
  if (!pending)
    pending = fetch("/kunstkiezer/api/basemap-config", {
      headers: { accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Kaartconfiguratie niet beschikbaar");
        const { key } = await response.json();
        if (typeof key !== "string" || !/^[A-Za-z0-9_-]{20,160}$/.test(key))
          throw new Error("Ongeldige kaartconfiguratie");
        return `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`;
      })
      .catch((error) => {
        pending = null;
        throw error;
      });
  return pending;
}
