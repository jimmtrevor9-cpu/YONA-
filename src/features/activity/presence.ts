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

export async function getPresence(userId: string): Promise<PresenceLevel> {
  const { data } = await supabase.rpc("get_presence", { _user_id: userId });
  return (data as PresenceLevel | null) ?? "unknown";
}
