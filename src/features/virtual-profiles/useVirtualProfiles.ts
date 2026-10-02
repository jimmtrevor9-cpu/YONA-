import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";

import { normalizePlace } from "@/features/geo/geo";
import {
  VIRTUAL_PROFILES,
  VIRTUAL_REMOVAL_ORDER,
  type VirtualProfile,
} from "@/features/virtual-profiles/data";
import { getRegisteredMembersCount } from "@/features/virtual-profiles/registered-count.functions";

/** Nombre minimum de profils d'exemple affichés (complétés par d'autres pays si besoin). */
const MIN_SHOWN = 10;
const MAX_SHOWN = 20;

type PhotoIndex = Record<string, { female: string[]; male: string[] }>;

const handledKey = (userId: string) => `yona.virtual.handled.${userId}`;

function readHandled(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(handledKey(userId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export interface VirtualFilters {
  /** Genre recherché (null : tous). */
  preferredGender: "male" | "female" | null;
  minAge: number | null;
  maxAge: number | null;
  country: string | null;
}

/**
 * Profils d'exemple à afficher : filtres du membre (genre, âge), son pays en premier,
 * moins ceux déjà likés/passés sur cet appareil et moins un profil par vrai inscrit.
 * Rien n'est lu ni écrit dans Supabase à propos de ces profils.
 */
export function useVirtualProfiles(userId: string, filters: VirtualFilters | null) {
  const fetchCount = useServerFn(getRegisteredMembersCount);
  const { data: registered = 0 } = useQuery({
    queryKey: ["virtual-profiles", "registered-count"],
    queryFn: () => fetchCount(),
    staleTime: 60 * 1000,
  });
  const { data: photos = {} } = useQuery({
    queryKey: ["virtual-profiles", "photos"],
    queryFn: async (): Promise<PhotoIndex> => {
      const response = await fetch("/virtual-profiles/index.json");
      return response.ok ? ((await response.json()) as PhotoIndex) : {};
    },
    staleTime: Infinity,
  });

  const [handled, setHandled] = useState<string[]>([]);
  useEffect(() => {
    if (userId) setHandled(readHandled(userId));
  }, [userId]);

  const markHandled = useCallback(
    (id: string) => {
      setHandled((current) => {
        const next = current.includes(id) ? current : [...current, id];
        try {
          window.localStorage.setItem(handledKey(userId), JSON.stringify(next));
        } catch {
          // Le profil réapparaîtra simplement à la prochaine visite.
        }
        return next;
      });
    },
    [userId],
  );

  const profiles = useMemo(() => {
    if (!filters) return [];
    const hidden = new Set(VIRTUAL_REMOVAL_ORDER.slice(0, registered));
    const done = new Set(handled);
    const eligible = VIRTUAL_PROFILES.filter(
      (p) =>
        !hidden.has(p.id) &&
        !done.has(p.id) &&
        (!filters.preferredGender || p.gender === filters.preferredGender) &&
        (filters.minAge === null || p.age >= filters.minAge) &&
        (filters.maxAge === null || p.age <= filters.maxAge),
    );
    const home = filters.country ? normalizePlace(filters.country) : "";
    const local = eligible.filter((p) => home && normalizePlace(p.country) === home);
    const others = eligible.filter((p) => !local.includes(p));
    const fill = Math.max(0, MIN_SHOWN - local.length);
    return [...local, ...others.slice(0, fill)].slice(0, MAX_SHOWN);
  }, [filters, registered, handled]);

  const photoOf = useCallback(
    (p: VirtualProfile): string | null => photos[p.folder]?.[p.gender]?.[p.photoIndex - 1] ?? null,
    [photos],
  );

  return { profiles, photoOf, markHandled };
}
