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

/** Signale l'activité de l'utilisateur courant (met à jour last_seen_at côté serveur). */
export async function touchActivity() {
  await supabase.rpc("touch_activity");
}

export async function getPresence(userId: string): Promise<PresenceLevel> {
  const { data } = await supabase.rpc("get_presence", { _user_id: userId });
  return (data as PresenceLevel | null) ?? "unknown";
}
