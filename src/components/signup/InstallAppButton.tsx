import { Download } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    /** Proposition d'installation de Chrome, gardée par le script du <head> (__root.tsx). */
    __yonaInstallPrompt?: InstallPromptEvent | null;
  }
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function helpText() {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    return "Sur iPhone : touchez « Partager » puis « Sur l'écran d'accueil ».";
  }
  return "Ouvrez le menu du navigateur (⋮) puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».";
}

/**
 * « Installer l'application » : au clic, ouvre directement la fenêtre d'installation de
 * Chrome (Android, ordinateur). Quand le navigateur ne la propose pas (iPhone, Safari,
 * application déjà installée…), une courte explication s'affiche à la place.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState<string | null>(null);

  useEffect(() => {
    if (isStandalone()) setInstalled(true);
    setPromptEvent(window.__yonaInstallPrompt ?? null);
    // Si le script du <head> n'a pas encore vu passer la proposition, on l'écoute ici aussi.
    const onPrompt = (event: Event) => {
      event.preventDefault();
      window.__yonaInstallPrompt = event as InstallPromptEvent;
      setPromptEvent(event as InstallPromptEvent);
    };
    const onStored = () => setPromptEvent(window.__yonaInstallPrompt ?? null);
    const onInstalled = () => {
      window.__yonaInstallPrompt = null;
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("yona:installprompt", onStored);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("yona:installprompt", onStored);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    const event = promptEvent ?? window.__yonaInstallPrompt ?? null;
    if (event) {
      try {
        await event.prompt();
        const { outcome } = await event.userChoice;
        if (outcome === "accepted") setInstalled(true);
      } catch {
        setHelp(helpText());
      }
      // Une proposition ne sert qu'une fois ; Chrome en renverra une nouvelle si besoin.
      window.__yonaInstallPrompt = null;
      setPromptEvent(null);
      return;
    }
    setHelp(helpText());
  }

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => void install()}
        data-testid="install-app"
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-2 text-sm text-foreground backdrop-blur"
      >
        <Download className="h-4 w-4" /> Installer l'application
      </button>
      {help ? (
        <p
          role="status"
          data-testid="install-help"
          className="max-w-xs text-center text-xs text-muted-foreground"
        >
          {help}
        </p>
      ) : null}
    </div>
  );
}
