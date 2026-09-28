import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Niveaux de présence renvoyés par la fonction serveur `get_presence` (jamais d'horodatage exact). */
export type PresenceLevel = "online" | "recent" | "this_week" | "inactive" | "unknown";

export const PRESENCE_LABELS: Record<PresenceLevel, string> = {
  online: "En ligne",
  recent: "Actif récemment",
  this_week: "Actif cette semaine",
  inactive: "Actif il y a plusieurs jours",
  unknown: "",
};

/**
 * Signale l'activité de la personne connectée (date fixée par le serveur). Renvoie `true`
 * si elle a été enregistrée, `false` si le compte n'est pas actif.
 */
export async function touchActivity(): Promise<boolean> {
  const { data, error } = await supabase.rpc("touch_activity");
  if (error) throw error;
  return data === true;
}

/**
 * Statut de présence d'un membre, calculé par le serveur (`get_presence`) :
 * « En ligne » s'il est connecté et actif depuis moins de 3 minutes, puis « Actif
 * récemment » (24 h), « Actif cette semaine » (7 jours), sinon « Actif il y a plusieurs
 * jours ». « unknown » si aucune activité n'est connue ou si le statut n'est pas
 * consultable (profil masqué, blocage…).
 */
export async function getPresence(userId: string): Promise<PresenceLevel> {
  const { data, error } = await supabase.rpc("get_presence", { _user_id: userId });
  if (error) throw error;
  return (data as PresenceLevel | null) ?? "unknown";
}

/** À la déconnexion : la personne n'apparaît plus « en ligne ». */
export async function markOffline() {
  const { error } = await supabase.rpc("mark_offline");
  if (error) throw error;
}

/** Statut de présence d'un membre, actualisé chaque minute tant qu'il est affiché. */
export const presenceQuery = (userId: string) =>
  queryOptions({
    queryKey: ["presence", userId],
    queryFn: () => getPresence(userId),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
