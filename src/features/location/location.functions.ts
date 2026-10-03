import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clientContextHeaders } from "@/integrations/supabase/request-context";

/**
 * Tâche E — Localisation réelle du membre. Ordre de priorité (repli automatique) :
 *   1. position de l'appareil (GPS / Wi-Fi), non trompée par un VPN ;
 *   2. ville déclarée à l'étape « Où es-tu ? » ;
 *   3. adresse IP (dernier recours ; un VPN la change).
 * Le serveur fait le géocodage, puis la base garde la position retenue et compare les
 * indices (pays de l'IP, fuseau horaire) : une contradiction lève le drapeau
 * « incohérence de localisation » visible par l'administration, sans rien bloquer.
 */

const hints = {
  timezone: z.string().max(64).optional(),
  language: z.string().max(35).optional(),
};

async function serviceClient() {
  const { createSupabaseServiceClient } = await import("@/integrations/supabase/client.server");
  return createSupabaseServiceClient(clientContextHeaders(getRequest()));
}

export interface LocationResult {
  retained: "device" | "declared" | "ip" | null;
  country: string | null;
  city: string | null;
}

async function save(
  userId: string,
  source: "device" | "declared" | "ip",
  place: {
    latitude: number;
    longitude: number;
    countryCode: string | null;
    region: string | null;
    city: string | null;
  } | null,
  extra: {
    accuracy?: number | undefined;
    timezone?: string | undefined;
    language?: string | undefined;
    ipCountry?: string | null;
    ipCity?: string | null;
  },
): Promise<LocationResult> {
  const client = await serviceClient();
  if (!client) throw new Error("location_unavailable");
  const { data, error } = await client.rpc("set_member_location", {
    _user_id: userId,
    _source: source,
    ...(place
      ? {
          _latitude: place.latitude,
          _longitude: place.longitude,
          ...(place.countryCode ? { _country_code: place.countryCode } : {}),
          ...(place.region ? { _region: place.region } : {}),
          ...(place.city ? { _city: place.city } : {}),
        }
      : {}),
    ...(extra.accuracy ? { _accuracy_m: Math.round(extra.accuracy) } : {}),
    ...(extra.timezone ? { _timezone: extra.timezone } : {}),
    ...(extra.language ? { _language: extra.language } : {}),
    ...(extra.ipCountry ? { _ip_country: extra.ipCountry } : {}),
    ...(extra.ipCity ? { _ip_city: extra.ipCity } : {}),
  });
  if (error) {
    const { logServerError } = await import("@/features/journal/server-errors.server");
    await logServerError("localisation", error.message, { userId, details: { source } });
    throw new Error("location_failed");
  }
  const d = (data ?? {}) as {
    retained?: LocationResult["retained"];
    country?: string | null;
    city?: string | null;
  };
  return { retained: d.retained ?? null, country: d.country ?? null, city: d.city ?? null };
}

/** 1. Position de l'appareil (autorisée par le membre) : géocodage inverse puis enregistrement. */
export const recordDeviceLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracy: z.number().min(0).max(1_000_000).optional(),
        ...hints,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { reverseGeocode } = await import("@/features/location/geocoder.server");
    const place = await reverseGeocode(data.latitude, data.longitude).catch(() => null);
    return save(
      context.userId,
      "device",
      {
        latitude: data.latitude,
        longitude: data.longitude,
        countryCode: place?.countryCode ?? null,
        region: place?.region ?? null,
        city: place?.city ?? null,
      },
      data,
    );
  });

/** 2. Ville déclarée (profil) : position de la ville, retenue si l'appareil n'a rien donné. */
export const recordDeclaredLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object(hints).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("country, region, city")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { locateDeclared } = await import("@/features/location/geocoder.server");
    const place = profile
      ? await locateDeclared(profile.country, profile.region, profile.city).catch(() => null)
      : null;
    // Ville inconnue : seuls les indices sont mis à jour (le pays du profil reste la référence).
    return save(context.userId, "declared", place, data);
  });

/**
 * 3. À chaque visite : pays de l'adresse IP et fuseau horaire (indices). Si le membre n'a
 * encore aucune position : sa ville déclarée si elle est connue ; la position de l'adresse
 * IP seulement s'il n'a déclaré aucun pays (dernier recours). Un membre qui a retiré la
 * position de son appareil retrouve sa ville déclarée, jamais la position de son IP.
 */
export const recordLocationHints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object(hints).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    try {
      const h = getRequest()?.headers;
      const ipCountry = h?.get("x-vercel-ip-country")?.toUpperCase() ?? null;
      let ipCity: string | null = null;
      try {
        ipCity = h?.get("x-vercel-ip-city")
          ? decodeURIComponent(h.get("x-vercel-ip-city") ?? "")
          : null;
      } catch {
        ipCity = null;
      }
      const extra = { ...data, ipCountry, ipCity };
      const [{ data: current }, { data: profile }] = await Promise.all([
        context.supabase
          .from("profile_locations")
          .select("source")
          .eq("user_id", context.userId)
          .maybeSingle(),
        context.supabase
          .from("profiles")
          .select("country, region, city")
          .eq("user_id", context.userId)
          .maybeSingle(),
      ]);
      const geo = await import("@/features/location/geocoder.server");
      if (!current && profile?.country) {
        const declared = await geo
          .locateDeclared(profile.country, profile.region, profile.city)
          .catch(() => null);
        return await save(context.userId, "declared", declared, extra);
      }
      const lat = Number(h?.get("x-vercel-ip-latitude"));
      const lng = Number(h?.get("x-vercel-ip-longitude"));
      const hasPosition =
        Number.isFinite(lat) && Number.isFinite(lng) && !!h?.get("x-vercel-ip-latitude");
      // Position de l'IP : seulement sans aucune autre (ni position, ni pays déclaré).
      let place = null;
      if (hasPosition && (!current ? !profile?.country : current.source === "ip")) {
        const found = await geo.reverseGeocode(lat, lng).catch(() => null);
        place = {
          latitude: lat,
          longitude: lng,
          countryCode: found?.countryCode ?? ipCountry,
          region: found?.region ?? null,
          city: ipCity ?? found?.city ?? null,
        };
      }
      return await save(context.userId, "ip", place, extra);
    } catch {
      // Indices indisponibles : sans effet pour le membre.
      return { retained: null, country: null, city: null } satisfies LocationResult;
    }
  });
