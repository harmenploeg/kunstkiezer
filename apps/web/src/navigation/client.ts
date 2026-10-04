import { useEffect, useState } from "react";
import { BASE_PATH, isPagePath } from "../../../../packages/domain/src/navigation.ts";

const routeEvent = "kunstkiezer:navigate";
const currentRoute = () => location.pathname + location.search;

/** Keep internal navigation inside the installed iOS app, without reloading providers. */
export function navigate(href: string, replace = false) {
  history[replace ? "replaceState" : "pushState"](null, "", href);
  window.dispatchEvent(new Event(routeEvent));
  window.scrollTo(0, 0);
}

export function useClientRoute() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const update = () => setRoute(currentRoute());
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || url.hash) return;
      if (url.pathname !== BASE_PATH && !url.pathname.startsWith(BASE_PATH + "/")) return;
      const path = url.pathname.slice(BASE_PATH.length).replace(/\/$/, "") || "/";
      if (!isPagePath(path)) return;
      event.preventDefault();
      if (currentRoute() !== url.pathname + url.search) navigate(url.pathname + url.search);
    };
    document.addEventListener("click", click);
    window.addEventListener(routeEvent, update);
    window.addEventListener("popstate", update);
    return () => {
      document.removeEventListener("click", click);
      window.removeEventListener(routeEvent, update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return route;
}
