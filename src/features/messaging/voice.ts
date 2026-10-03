import { supabase } from "@/integrations/supabase/client";

/**
 * Messages vocaux (Premium). Le fichier est déposé dans le stockage privé
 * « voice-messages » (dossier conversation / expéditeur), puis enregistré comme message
 * par `send_voice_message`, qui vérifie Premium, la durée, le fichier et la conversation.
 */
export const VOICE_BUCKET = "voice-messages";
export const VOICE_MAX_SECONDS = 120;
export const VOICE_MAX_BYTES = 2 * 1024 * 1024;
/** Durée de validité des liens d'écoute (stockage privé). */
const SIGNED_URL_SECONDS = 60 * 60;

export const VOICE_ERRORS = {
  premium_required: "Les messages vocaux sont réservés aux membres Premium.",
  voice_invalid_duration: "Le message vocal doit durer entre 1 seconde et 2 minutes.",
  voice_file_invalid: "Le message vocal n'a pas pu être enregistré. Réessayez.",
  conversation_unavailable: "Cette conversation n'est plus disponible.",
  microphone_denied:
    "Micro inaccessible : autorisez l'accès au micro dans votre navigateur pour enregistrer.",
  too_large: "Message vocal trop lourd (2 Mo au plus). Faites-le plus court.",
  identity_not_verified: "Vérifiez votre identité pour envoyer des messages vocaux.",
} as const;

export function voiceErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code = (Object.keys(VOICE_ERRORS) as (keyof typeof VOICE_ERRORS)[]).find((key) =>
    message.includes(key),
  );
  if (code) return VOICE_ERRORS[code];
  if (/row-level security|unauthorized|403/i.test(message)) return VOICE_ERRORS.premium_required;
  return "Le message vocal n'a pas pu être envoyé. Vérifiez votre connexion et réessayez.";
}

/** Premier format d'enregistrement pris en charge par le navigateur. */
export function pickVoiceMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function extensionFor(type: string): string {
  if (type.startsWith("audio/ogg")) return "ogg";
  if (type.startsWith("audio/mp4")) return "m4a";
  if (type.startsWith("audio/mpeg")) return "mp3";
  return "webm";
}

/** Dépose l'enregistrement puis l'envoie comme message vocal. */
export async function sendVoiceMessage(input: {
  userId: string;
  conversationId: string;
  blob: Blob;
  durationSeconds: number;
}): Promise<string> {
  if (input.blob.size > VOICE_MAX_BYTES) throw new Error("too_large");
  const contentType = (input.blob.type || "audio/webm").split(";")[0] ?? "audio/webm";
  const path = `${input.conversationId}/${input.userId}/${crypto.randomUUID()}.${extensionFor(contentType)}`;
  const upload = await supabase.storage
    .from(VOICE_BUCKET)
    .upload(path, input.blob, { contentType, upsert: false });
  if (upload.error) throw upload.error;
  const { data, error } = await supabase.rpc("send_voice_message", {
    _conversation_id: input.conversationId,
    _audio_path: path,
    _duration_seconds: Math.min(Math.max(Math.round(input.durationSeconds), 1), VOICE_MAX_SECONDS),
  });
  if (error) {
    // Refusé : le fichier n'est pas laissé dans le stockage.
    await supabase.storage.from(VOICE_BUCKET).remove([path]);
    throw error;
  }
  return data as string;
}

/** Lien d'écoute temporaire d'un message vocal (participants seulement). */
export async function voiceMessageUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(VOICE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

/** « 0:07 », « 1:42 ». */
export function formatVoiceDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
