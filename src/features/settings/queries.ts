import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Réglages du membre (valeurs par défaut tant que rien n'est enregistré). */
export interface UserSettings {
  activity_visible: boolean;
  notify_email: boolean;
  notify_messages: boolean;
  notify_matches: boolean;
  notify_likes: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  activity_visible: true,
  notify_email: true,
  notify_messages: true,
  notify_matches: true,
  notify_likes: true,
};

export const settingsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["settings", userId],
    queryFn: async (): Promise<UserSettings> => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("activity_visible, notify_email, notify_messages, notify_matches, notify_likes")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ?? DEFAULT_SETTINGS;
    },
  });

/** Enregistre un réglage (la ligne est créée au premier enregistrement). */
export async function saveSetting(userId: string, patch: Partial<UserSettings>) {
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
  if (error) throw error;
}

/** 20.2 — Profil visible ou masqué (colonne existante `profiles.visibility`). */
export async function saveProfileVisibility(userId: string, visible: boolean) {
  const { error } = await supabase
    .from("profiles")
    .update({ visibility: visible ? "visible" : "hidden" })
    .eq("user_id", userId);
  if (error) throw error;
}

/** Membres bloqués (21.3), pour les débloquer. */
export const blockedUsersQuery = (userId: string) =>
  queryOptions({
    queryKey: ["blocks", "mine", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_blocked_users");
      if (error) throw error;
      return data ?? [];
    },
  });

export const PASSWORD_MIN_LENGTH = 8;

/** 20.8 — Changement de mot de passe : l'ancien est revérifié avant. */
export async function changePassword(email: string, current: string, next: string) {
  const check = await supabase.auth.signInWithPassword({ email, password: current });
  if (check.error) throw new Error("Mot de passe actuel incorrect.");
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    if (/should be different|same/i.test(error.message)) {
      throw new Error("Le nouveau mot de passe doit être différent de l'ancien.");
    }
    throw new Error("Le mot de passe n'a pas pu être changé. Réessayez.");
  }
}
