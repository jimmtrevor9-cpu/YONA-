/**
 * Brouillon d'inscription.
 *
 * Le nouveau parcours fait remplir le profil AVANT de créer le compte (e-mail ou Google).
 * Les réponses sont gardées :
 *   - dans le navigateur (localStorage + IndexedDB pour les photos), pour survivre à la
 *     redirection Google ou au clic sur le lien de confirmation reçu par e-mail ;
 *   - dans les métadonnées du compte (sans les photos) lors d'une inscription par e-mail,
 *     au cas où le lien de confirmation serait ouvert sur un autre appareil.
 * Une fois connecté, `applySignupDraft` enregistre tout dans la base.
 */
import type { User } from "@supabase/supabase-js";

import { uploadPhoto } from "@/features/profiles/photos";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Gender = Database["public"]["Enums"]["gender"];

export type SignupMethod = "email" | "google";
export type LookingFor = "male" | "female" | "all";

export interface SignupDraft {
  method: SignupMethod;
  firstName: string;
  birthDate: string;
  gender: Gender | "";
  lookingFor: LookingFor;
  minAge: number;
  maxAge: number;
  passions: string[];
  weekend: string;
  quality: string;
  bio: string;
  country: string;
  region: string;
  city: string;
  purpose: string;
  marketing: boolean | null;
  /** Date d'acceptation des conditions (case « 18 ans ou plus » cochée). */
  termsAcceptedAt: string | null;
}

export const EMPTY_DRAFT: SignupDraft = {
  method: "email",
  firstName: "",
  birthDate: "",
  gender: "",
  lookingFor: "all",
  minAge: 25,
  maxAge: 45,
  passions: [],
  weekend: "",
  quality: "",
  bio: "",
  country: "",
  region: "",
  city: "",
  purpose: "",
  marketing: null,
  termsAcceptedAt: null,
};

/* ------------------------------------------------------------------ */
/* Choix proposés dans le parcours                                     */
/* ------------------------------------------------------------------ */

export const PASSIONS_MAX = 4;
export const PASSION_CHOICES = [
  "Louange",
  "Musique",
  "Lecture",
  "Cuisine",
  "Voyages",
  "Sport",
  "Danse",
  "Cinéma",
  "Nature",
  "Bénévolat",
  "Mode",
  "Photographie",
] as const;

export const WEEKEND_CHOICES = [
  "Culte puis repas en famille",
  "Balade et bon restaurant",
  "Soirée films à la maison",
  "Sortie entre amis",
  "Activité sportive",
] as const;

export const QUALITY_CHOICES = [
  "La fidélité",
  "La douceur",
  "L'humour",
  "La générosité",
  "La sincérité",
  "Une foi solide",
] as const;

/**
 * « Pourquoi tu es là ? » : adapté aux valeurs de YONA (rencontre chrétienne sérieuse).
 * La valeur est enregistrée dans `preferences.relationship_goal`.
 */
export const PURPOSE_CHOICES = [
  { value: "Mariage", label: "Me marier", emoji: "💍" },
  { value: "Relation sérieuse", label: "Relation sérieuse", emoji: "❤️" },
  { value: "Faire connaissance d'abord", label: "Faire connaissance", emoji: "☕" },
  { value: "Amitié chrétienne", label: "Amitié chrétienne", emoji: "🤝" },
] as const;

/** Curseur « Âge des profils » : 60 sur le curseur veut dire « 60 ans et plus » (99). */
export const AGE_SLIDER_MIN = 18;
export const AGE_SLIDER_MAX = 60;
export const AGE_OPEN_MAX = 99;

export function sliderToAge(value: number): number {
  return value >= AGE_SLIDER_MAX ? AGE_OPEN_MAX : value;
}
export function ageToSlider(age: number): number {
  return Math.min(Math.max(age, AGE_SLIDER_MIN), AGE_SLIDER_MAX);
}
export function ageLabel(age: number): string {
  return age >= AGE_SLIDER_MAX ? `${AGE_SLIDER_MAX}+` : String(age);
}

/** Bio proposée à partir des puces choisies (modifiable avant d'être gardée). */
export function suggestBio(draft: Pick<SignupDraft, "passions" | "weekend" | "quality">): string {
  const parts: string[] = [];
  if (draft.passions.length) {
    const list = draft.passions.map((p) => p.toLocaleLowerCase("fr"));
    const text =
      list.length > 1 ? `${list.slice(0, -1).join(", ")} et ${list[list.length - 1]}` : list[0];
    parts.push(`Passionné·e de ${text}.`);
  }
  if (draft.weekend) {
    parts.push(`Mon week-end idéal : ${draft.weekend.toLocaleLowerCase("fr")}.`);
  }
  if (draft.quality) {
    parts.push(`Ce qui compte pour moi chez l'autre : ${draft.quality.toLocaleLowerCase("fr")}.`);
  }
  if (parts.length) parts.push("Je cherche une belle histoire, avec Dieu au centre.");
  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/* Sauvegarde dans le navigateur                                       */
/* ------------------------------------------------------------------ */

const DRAFT_KEY = "yona.signup.draft";
/** Un brouillon abandonné n'est plus repris après ce délai (appareil partagé). */
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function loadLocalDraft(): SignupDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const { savedAt, ...draft } = JSON.parse(raw) as Partial<SignupDraft> & { savedAt?: number };
    if (!savedAt || Date.now() - savedAt > DRAFT_MAX_AGE_MS) return null;
    return { ...EMPTY_DRAFT, ...draft };
  } catch {
    return null;
  }
}

/** Même personne : le brouillon du navigateur correspond à celui gardé avec le compte. */
export function sameDraftOwner(a: SignupDraft, b: SignupDraft): boolean {
  return a.firstName.trim() === b.firstName.trim() && a.birthDate === b.birthDate;
}

export function saveLocalDraft(draft: SignupDraft) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // Navigation privée ou stockage plein : le parcours continue sans sauvegarde locale.
  }
}

export function clearLocalDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Rien à faire.
  }
  void clearDraftPhotos();
}

/** Brouillon envoyé avec l'inscription par e-mail (métadonnées du compte). */
export function draftFromUser(user: User | null): SignupDraft | null {
  const raw = (user?.user_metadata as { signup_draft?: Partial<SignupDraft> } | undefined)
    ?.signup_draft;
  if (!raw || typeof raw !== "object") return null;
  return { ...EMPTY_DRAFT, ...raw };
}

/** Le brouillon contient tout ce qu'il faut pour créer le profil sans rien redemander. */
export function isDraftComplete(draft: SignupDraft | null): draft is SignupDraft {
  return !!(
    draft &&
    draft.firstName.trim() &&
    draft.birthDate &&
    draft.gender &&
    draft.termsAcceptedAt
  );
}

/* Photos : gardées dans IndexedDB (trop lourdes pour localStorage). */
const DB_NAME = "yona-signup";
const STORE = "photos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexeddb_unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb_error"));
  });
}

export async function saveDraftPhotos(files: File[]) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(files, "files");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("indexeddb_error"));
    });
    db.close();
  } catch {
    // Les photos pourront être ajoutées plus tard depuis le profil.
  }
}

export async function loadDraftPhotos(): Promise<File[]> {
  try {
    const db = await openDb();
    const files = await new Promise<File[]>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get("files");
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error ?? new Error("indexeddb_error"));
    });
    db.close();
    return files;
  } catch {
    return [];
  }
}

async function clearDraftPhotos() {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete("files");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // Rien à faire.
  }
}

/* ------------------------------------------------------------------ */
/* Enregistrement dans la base                                         */
/* ------------------------------------------------------------------ */

/** Fenêtres d'accueil à montrer une fois le profil créé (voir WelcomeSequence). */
export function welcomeKey(userId: string) {
  return `yona.welcome.${userId}`;
}

/**
 * Enregistre le brouillon pour le membre connecté et rend son profil visible.
 * Renvoie le nombre de photos envoyées (une photo refusée n'empêche pas l'inscription).
 */
export async function applySignupDraft(
  userId: string,
  draft: SignupDraft,
  photos: File[],
): Promise<{ photosSent: number; photoErrors: number }> {
  const prefs = await supabase
    .from("preferences")
    .update({
      preferred_gender: draft.lookingFor === "all" ? null : draft.lookingFor,
      min_age: draft.minAge,
      max_age: draft.maxAge,
      relationship_goal: draft.purpose.trim() || null,
    })
    .eq("user_id", userId);
  if (prefs.error) throw prefs.error;

  if (draft.marketing !== null) {
    const settings = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, marketing_emails: draft.marketing }, { onConflict: "user_id" });
    if (settings.error) throw settings.error;
  }

  // Le profil (qui devient actif et visible) est enregistré en dernier : un échec
  // précédent ne laisse jamais un profil visible à moitié rempli.
  const profile = await supabase
    .from("profiles")
    .update({
      first_name: draft.firstName.trim() || null,
      gender: draft.gender || null,
      birth_date: draft.birthDate || null,
      bio: draft.bio.trim() || null,
      interests: draft.passions.slice(0, PASSIONS_MAX),
      country: draft.country.trim() || null,
      region: draft.region.trim() || null,
      city: draft.city.trim() || null,
      terms_accepted_at: draft.termsAcceptedAt,
      onboarding_step: 4,
      onboarding_completed_at: new Date().toISOString(),
      status: "active",
      visibility: "visible",
    })
    .eq("user_id", userId);
  if (profile.error) throw profile.error;

  let photosSent = 0;
  let photoErrors = 0;
  for (const file of photos) {
    try {
      await uploadPhoto(userId, file);
      photosSent += 1;
    } catch {
      photoErrors += 1;
    }
  }
  return { photosSent, photoErrors };
}
