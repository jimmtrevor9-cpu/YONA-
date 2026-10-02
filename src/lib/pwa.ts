/**
 * Application installable (PWA).
 *
 * Le navigateur annonce qu'il peut installer le site avec l'événement
 * « beforeinstallprompt », souvent dès le chargement, avant même que React démarre.
 * Un petit script placé dans <head> (voir __root.tsx) le met donc de côté dans
 * `window.__yonaInstallPrompt` ; ce module le reprend pour le bouton « Installer ».
 */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __yonaInstallPrompt?: InstallPromptEvent | null;
  }
}

/** Événement interne envoyé quand l'installation devient possible (ou ne l'est plus). */
export const INSTALL_PROMPT_CHANGED = "yona:installprompt";

/** Script exécuté très tôt (dans <head>) : garde l'événement d'installation. */
export const EARLY_INSTALL_SCRIPT = `
window.__yonaInstallPrompt = null;
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  window.__yonaInstallPrompt = e;
  window.dispatchEvent(new Event("${INSTALL_PROMPT_CHANGED}"));
});
window.addEventListener("appinstalled", function () {
  window.__yonaInstallPrompt = null;
  window.dispatchEvent(new Event("${INSTALL_PROMPT_CHANGED}"));
});
`;

export function getInstallPrompt(): InstallPromptEvent | null {
  return typeof window === "undefined" ? null : (window.__yonaInstallPrompt ?? null);
}

export function clearInstallPrompt() {
  window.__yonaInstallPrompt = null;
  window.dispatchEvent(new Event(INSTALL_PROMPT_CHANGED));
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone / iPad (y compris les iPad qui se présentent comme un Mac). */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** Enregistre le service worker (en ligne uniquement, pas pendant le développement). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sans service worker, le site fonctionne normalement (seulement moins vite hors ligne).
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
