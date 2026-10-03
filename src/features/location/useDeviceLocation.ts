import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";

import { recordDeviceLocation, type LocationResult } from "@/features/location/location.functions";
import { browserHints, readDevicePosition } from "@/features/profiles/location";

/**
 * Tâche E — Partage de la position de l'appareil (GPS / Wi-Fi) : demandée au navigateur
 * avec l'accord du membre, puis envoyée au serveur, qui trouve la ville et le pays.
 */
export function useShareDeviceLocation(): (fresh?: boolean) => Promise<LocationResult> {
  const send = useServerFn(recordDeviceLocation);
  return useCallback(
    async (fresh = false) => {
      const position = await readDevicePosition(fresh ? 0 : undefined);
      return send({ data: { ...position, ...browserHints() } });
    },
    [send],
  );
}
