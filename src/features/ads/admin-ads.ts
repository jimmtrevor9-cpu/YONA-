import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { adminErrorMessage } from "@/features/admin/admin.functions";
import type { PeriodRange } from "@/features/admin/dashboard";
import { ADS_BUCKET, adFileUrl, type AdCtaIcon, type SponsoredAd } from "@/features/ads/ads";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Tâche D3 — Gestion des publicités par l'administration. Les règles d'accès de la base
 * réservent la table `ads`, le journal `ad_events` et l'espace de fichiers « ads » aux
 * administrateurs : un membre ne peut ni lire ni modifier une publicité.
 */
export type AdRow = Database["public"]["Tables"]["ads"]["Row"];
export type AdStatus = "draft" | "active" | "paused";

export const AD_PLACEMENTS = [
  { value: "discover", label: "Découvrir (carte plein écran)" },
  { value: "matches", label: "Liste des Matchs" },
  { value: "messages", label: "Liste des messages" },
] as const;

export const AD_CTA_ICONS: { value: AdCtaIcon; label: string }[] = [
  { value: "external", label: "Lien" },
  { value: "message", label: "Message" },
  { value: "phone", label: "Téléphone" },
];

export const MEDIA_RULES = {
  image: {
    types: ["image/jpeg", "image/png", "image/webp"],
    max: 5 * 1024 * 1024,
    label: "JPEG, PNG ou WebP, 5 Mo max.",
  },
  video: {
    types: ["video/mp4", "video/webm"],
    max: 15 * 1024 * 1024,
    label: "MP4 ou WebM, 15 Mo max.",
  },
} as const;

export function mediaKind(file: File): "image" | "video" | null {
  if ((MEDIA_RULES.image.types as readonly string[]).includes(file.type)) return "image";
  if ((MEDIA_RULES.video.types as readonly string[]).includes(file.type)) return "video";
  return null;
}

/** Vérifie le format et la taille avant l'envoi (la base et le stockage revérifient). */
export function mediaError(file: File, only?: "image"): string | null {
  const kind = mediaKind(file);
  if (!kind || (only && kind !== only)) {
    return only
      ? `Image attendue : ${MEDIA_RULES.image.label}`
      : "Format accepté : JPEG, PNG, WebP, MP4 ou WebM.";
  }
  if (file.size > MEDIA_RULES[kind].max) return `Fichier trop lourd : ${MEDIA_RULES[kind].label}`;
  return null;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

/** Envoie un fichier dans le dossier de la publicité ; renvoie son chemin. */
export async function uploadAdFile(
  adId: string,
  file: Blob,
  kind: "media" | "poster",
): Promise<string> {
  const ext = EXT[file.type] ?? "bin";
  const path = `${adId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(ADS_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`Envoi du fichier impossible : ${error.message}`);
  return path;
}

/**
 * Image d'aperçu d'une vidéo (première seconde), affichée avant la lecture et sur les
 * connexions lentes. Renvoie null si le navigateur ne sait pas la produire.
 */
export function extractVideoPoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    const timer = setTimeout(() => finish(null), 8000);
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1080 / Math.max(video.videoWidth, 1));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx || !canvas.width) {
        clearTimeout(timer);
        finish(null);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          clearTimeout(timer);
          finish(blob);
        },
        "image/webp",
        0.82,
      );
    };
    video.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
  });
}

export const adminAdsQuery = () =>
  queryOptions({
    queryKey: ["admin", "ads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(adminErrorMessage(error.message));
      return data ?? [];
    },
  });

export const adSettingsQuery = () =>
  queryOptions({
    queryKey: ["admin", "ad-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ad_settings").select("*").maybeSingle();
      if (error) throw new Error(adminErrorMessage(error.message));
      return data ?? { id: true, discover_every: 5, list_every: 6, updated_at: "" };
    },
  });

export async function updateAdSettings(values: { discover_every: number; list_every: number }) {
  const { error } = await supabase.from("ad_settings").update(values).eq("id", true);
  if (error) throw new Error(adSaveError(error.message));
}

export type AdInput = Database["public"]["Tables"]["ads"]["Insert"] & { id: string };

export async function saveAd(input: AdInput, isNew: boolean) {
  const { id, ...values } = input;
  const { error } = isNew
    ? await supabase.from("ads").insert(input)
    : await supabase.from("ads").update(values).eq("id", id);
  if (error) throw new Error(adSaveError(error.message));
}

export async function setAdStatus(id: string, status: AdStatus) {
  const { error } = await supabase.from("ads").update({ status }).eq("id", id);
  if (error) throw new Error(adSaveError(error.message));
}

export async function deleteAd(id: string) {
  const { error } = await supabase.from("ads").delete().eq("id", id);
  if (error) throw new Error(adSaveError(error.message));
}

/** Messages clairs pour les refus de la base. */
export function adSaveError(message: string): string {
  if (message.includes("cta_url")) return "Le lien doit commencer par https:// (adresse complète).";
  if (message.includes("ads_dates_check"))
    return "La date de fin doit être après la date de début.";
  if (message.includes("ads_ages_check"))
    return "L'âge minimum doit être inférieur à l'âge maximum.";
  if (message.includes("title")) return "Le titre est obligatoire (90 caractères au plus).";
  if (message.includes("cta_label"))
    return "Le texte du bouton est obligatoire (24 caractères au plus).";
  if (message.includes("placements")) return "Choisissez au moins un emplacement.";
  if (message.includes("row-level security")) return "Accès réservé aux administrateurs.";
  return adminErrorMessage(message);
}

/** Publicité de la base → format d'affichage (aperçu dans l'administration). */
export function adPreview(
  row: Pick<
    AdRow,
    | "id"
    | "title"
    | "body"
    | "advertiser"
    | "media_type"
    | "media_path"
    | "poster_path"
    | "cta_label"
    | "cta_url"
    | "cta_icon"
  >,
): SponsoredAd {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    advertiser: row.advertiser,
    mediaType: row.media_type === "video" ? "video" : "image",
    mediaUrl: adFileUrl(row.media_path),
    posterUrl: row.poster_path ? adFileUrl(row.poster_path) : null,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    ctaIcon: (["external", "message", "phone"].includes(row.cta_icon)
      ? row.cta_icon
      : "external") as AdCtaIcon,
    everyN: 5,
  };
}

/** État affiché : programmée, en cours, terminée, en pause, brouillon. */
export function adState(ad: Pick<AdRow, "status" | "starts_at" | "ends_at">, now = Date.now()) {
  if (ad.status === "draft") return { label: "Brouillon", live: false };
  if (ad.status === "paused") return { label: "En pause", live: false };
  if (new Date(ad.starts_at).getTime() > now) return { label: "Programmée", live: false };
  if (ad.ends_at && new Date(ad.ends_at).getTime() <= now)
    return { label: "Terminée", live: false };
  return { label: "En ligne", live: true };
}

export interface AdStats {
  period: { from: string; to: string; bucket: PeriodRange["bucket"]; timezone: string };
  ads: {
    id: string;
    title: string;
    status: string;
    views: number;
    clicks: number;
    skips: number;
    viewers: number;
    ctr: number;
  }[];
  series: { start: string; views: number; clicks: number }[];
  by_country: { name: string; views: number; clicks: number; ctr: number }[];
}

export const adStatsQuery = (adId: string | null, range: PeriodRange | null) =>
  queryOptions({
    queryKey: ["admin", "ad-stats", adId, range?.from, range?.to, range?.bucket],
    enabled: !!range,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!range) return null;
      let tz = "UTC";
      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      } catch {
        // fuseau inconnu : UTC
      }
      const { data, error } = await supabase.rpc("admin_ad_stats", {
        _ad_id: adId,
        _from: range.from,
        _to: range.to,
        _bucket: range.bucket,
        _tz: tz,
      });
      if (error) throw new Error(adminErrorMessage(error.message));
      return data as unknown as AdStats;
    },
  });
