/**
 * Fichiers de la marque YONA (logo, images du slider, vidéo de présentation).
 *
 * Ils sont servis depuis le dossier `public/` : ils s'affichent donc partout, en local
 * comme en ligne sur Vercel. (Avant, ils pointaient vers le serveur de Lovable,
 * `/__l5e/assets-v1/…`, qui ne fonctionne pas en dehors de Lovable.)
 *
 * Pour changer un fichier : remplacer le fichier du même nom dans `public/brand/`
 * ou `public/videos/`, sans toucher au code.
 */

/** Logo officiel réduit à 512 px pour l'affichage (l'original 1920 px : yona-logo.png). */
export const BRAND_LOGO_URL = "/brand/yona-logo-512.png";

/** Images du slider de la page d'accueil, dans l'ordre (public/brand/slider/). */
export const BRAND_SLIDE_URLS = [1, 2, 3, 4, 5].map(
  (n) => `/brand/slider/yona-story-${n}.jpg`,
) as readonly string[];

/** Vidéo de présentation (45 s, version complète) et son image d'attente. */
export const BRAND_VIDEO_URL = "/videos/yona-presentation.mp4";
export const BRAND_VIDEO_POSTER_URL = "/videos/yona-presentation-poster.jpg";
