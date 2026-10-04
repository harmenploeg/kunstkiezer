import { useEffect, useState } from "react";
import { useRecommendations } from "../ranking/RecommendationContext.tsx";
import {
  validCoordinates,
  type Coordinates,
} from "../../../../../packages/domain/src/ranking.ts";

// Map centering is independent of ranking. Only reuse permission already granted;
// the map must never open a new location prompt or change the ranking preference.
export function useMapLocation(enabled: boolean): Coordinates | null {
  const { location: shared } = useRecommendations();
  const [fix, setFix] = useState<Coordinates | null>(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let permission: PermissionStatus | undefined;
    const update = () => {
      if (!active || !permission) return;
      if (permission.state !== "granted") {
        setFix(null);
        setDenied(true);
        return;
      }
      setDenied(false);
      navigator.geolocation?.getCurrentPosition(
        (position) => {
          if (!active || permission?.state !== "granted") return;
          const point = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          if (validCoordinates(point)) setFix(point);
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 0, timeout: 12000 },
      );
    };
    void navigator.permissions
      ?.query({ name: "geolocation" })
      .then((result) => {
        if (!active) return;
        permission = result;
        permission.addEventListener("change", update);
        update();
      })
      .catch(() => {
        /* Older browsers may still have an explicitly shared fix. */
      });
    return () => {
      active = false;
      permission?.removeEventListener("change", update);
    };
  }, [enabled]);
  return enabled && !denied ? (fix ?? shared) : null;
}
