import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface MyLocation {
  latitude: number;
  longitude: number;
  updatedAt: string;
  /** Origine : appareil, ville déclarée ou adresse IP (dernier recours). */
  source: "device" | "declared" | "ip";
  city: string | null;
  country: string | null;
}

export const LOCATION_SOURCE_LABEL: Record<MyLocation["source"], string> = {
  device: "position de votre appareil",
  declared: "ville indiquée sur votre profil",
  ip: "estimée d'après votre connexion",
};

/**
 * Position enregistrée de la personne connectée (arrondie à environ 1 km par le serveur).
 * Elle sert uniquement à la recherche par distance et n'est jamais visible par les autres
 * membres.
 */
export const myLocationQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profiles", "location", userId],
    queryFn: async (): Promise<MyLocation | null> => {
      const { data, error } = await supabase
        .from("profile_locations")
        .select("latitude, longitude, updated_at, source, city, country")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
            latitude: data.latitude,
            longitude: data.longitude,
            updatedAt: data.updated_at,
            source: (["device", "declared", "ip"].includes(data.source)
              ? data.source
              : "device") as MyLocation["source"],
            city: data.city,
            country: data.country,
          }
        : null;
    },
  });

/** Fuseau horaire et langue du navigateur (indices de localisation). */
export function browserHints(): { timezone?: string; language?: string } {
  const hints: { timezone?: string; language?: string } = {};
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) hints.timezone = tz.slice(0, 64);
  } catch {
    // fuseau inconnu
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    hints.language = navigator.language.slice(0, 35);
  }
  return hints;
}

/**
 * Position actuelle de l'appareil (autorisation demandée par le navigateur).
 * maxAgeMs : âge maximal d'une position déjà connue du navigateur (0 = nouvelle mesure).
 */
export function readDevicePosition(maxAgeMs = 10 * 60 * 1000): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
}> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) =>
        reject(new Error(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable")),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: maxAgeMs },
    );
  });
}

/** Enregistre la position (arrondie par le serveur à environ 1 km). */
export async function saveMyLocation(latitude: number, longitude: number) {
  const { error } = await supabase.rpc("set_my_location", {
    _latitude: latitude,
    _longitude: longitude,
  });
  if (error) throw error;
}

/** Retire la position enregistrée. */
export async function clearMyLocation() {
  const { error } = await supabase.rpc("clear_my_location");
  if (error) throw error;
}

/** Message à afficher quand la position n'a pas pu être obtenue ou enregistrée. */
export function locationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "denied") {
    return "Vous avez refusé l'accès à votre position. Autorisez-le dans votre navigateur pour l'utiliser.";
  }
  if (message === "unsupported") return "Votre appareil ne permet pas d'obtenir votre position.";
  if (message === "unavailable") return "Votre position n'a pas pu être obtenue. Réessayez.";
  return "Votre position n'a pas pu être enregistrée. Réessayez.";
}
