/**
 * Phase 2 — Accès typés aux quotas et fondations sociales.
 *
 * Toutes ces opérations passent par des fonctions SQL SECURITY DEFINER :
 * le serveur (base de données) reste la seule source de vérité.
 * Le client ne peut ni écrire ni modifier les compteurs directement.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ConversationQuota {
  allowed: boolean;
  used?: number;
  limit?: number | null;
  premium?: boolean;
  unlocked?: boolean;
  unlimited?: boolean;
  reason?: string;
}

export interface AiQuota {
  allowed: boolean;
  used?: number;
  limit?: number | null;
  unlimited?: boolean;
  reason?: string;
}

/** Quota de messages gratuits restant pour l'utilisateur courant sur une conversation. */
export async function getConversationQuota(conversationId: string): Promise<ConversationQuota> {
  const { data, error } = await supabase.rpc("get_conversation_quota", {
    _conversation_id: conversationId,
  });
  if (error) throw error;
  return data as unknown as ConversationQuota;
}

/** Consomme un message gratuit (ou confirme l'accès illimité Premium / déblocage actif). */
export async function consumeFreeMessage(conversationId: string): Promise<ConversationQuota> {
  const { data, error } = await supabase.rpc("consume_free_message", {
    _conversation_id: conversationId,
  });
  if (error) throw error;
  return data as unknown as ConversationQuota;
}

/** Un déblocage payé est-il actif sur cette conversation (valable pour les deux participants) ? */
export async function hasActiveConversationUnlock(conversationId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_active_conversation_unlock", {
    _conversation_id: conversationId,
  });
  if (error) throw error;
  return Boolean(data);
}

/** Quota Roi Salomon du jour (lecture seule). */
export async function getAiQuota(feature = "roi_salomon"): Promise<AiQuota> {
  const { data, error } = await supabase.rpc("get_ai_quota", { _feature: feature });
  if (error) throw error;
  return data as unknown as AiQuota;
}

/** Consomme une question Roi Salomon. Renvoie allowed=false si le quota gratuit est épuisé. */
export async function consumeAiQuota(feature = "roi_salomon"): Promise<AiQuota> {
  const { data, error } = await supabase.rpc("consume_ai_quota", { _feature: feature });
  if (error) throw error;
  return data as unknown as AiQuota;
}

/** Ajoute un profil aux favoris de l'utilisateur courant. */
export async function addFavorite(favoriteUserId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("unauthenticated");
  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: auth.user.id, favorite_user_id: favoriteUserId });
  if (error) throw error;
}

/** Retire un profil des favoris de l'utilisateur courant. */
export async function removeFavorite(favoriteUserId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("unauthenticated");
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("favorite_user_id", favoriteUserId);
  if (error) throw error;
}

/** Favoris de l'utilisateur courant. */
export async function listMyFavorites() {
  const { data, error } = await supabase
    .from("favorites")
    .select("favorite_user_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** « Qui m'a ajouté en favori » — réservé Premium (filtré côté serveur). */
export async function listFavoritedBy() {
  const { data, error } = await supabase.rpc("get_favorited_by");
  if (error) throw error;
  return data ?? [];
}

/** Enregistre une visite de profil (ignorée si auto-visite, blocage ou doublon récent). */
export async function recordProfileVisit(visitedUserId: string) {
  const { error } = await supabase.rpc("record_profile_visit", {
    _visited_user_id: visitedUserId,
  });
  if (error) throw error;
}

/** « Qui a visité mon profil » — réservé Premium (filtré côté serveur). */
export async function listProfileVisitors() {
  const { data, error } = await supabase.rpc("get_profile_visitors");
  if (error) throw error;
  return data ?? [];
}
