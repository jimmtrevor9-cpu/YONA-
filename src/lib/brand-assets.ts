/**
 * Images de la marque YONA, servies telles quelles depuis le dossier public/images.
 * (Avant : fichiers « .asset.json » qui pointaient vers le stockage de Lovable,
 * inaccessible une fois le site hébergé ailleurs, par exemple sur Vercel.)
 */
export const LOGO_URL = "/images/yona-logo.png";

export const STORY_IMAGES = [
  "/images/yona-story-1.jpg",
  "/images/yona-story-2.jpg",
  "/images/yona-story-3.jpg",
  "/images/yona-story-4.jpg",
  "/images/yona-story-5.jpg",
] as const;

/** Vidéo de présentation de la page d'accueil (45 s, lue en entier). */
export const PRESENTATION_VIDEO_URL = "/videos/yona.mp4";
