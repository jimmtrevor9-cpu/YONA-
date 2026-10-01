import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * « Installer l'application » : utilise l'installation proposée par le navigateur
 * (Android, ordinateur) quand elle existe, sinon explique comment ajouter YONA à l'écran
 * d'accueil (iPhone : Partager → Sur l'écran d'accueil).
 */
export function InstallAppButton({ className }: { className?: string }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(display-mode: standalone)").matches) setInstalled(true);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setPromptEvent(null);
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast.info(
      ios
        ? "Sur iPhone : touchez « Partager » puis « Sur l'écran d'accueil »."
        : "Ouvrez le menu du navigateur (⋮) puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».",
      { duration: 8000 },
    );
  }

  return (
    <button
      type="button"
      onClick={() => void install()}
      data-testid="install-app"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-2 text-sm text-foreground backdrop-blur",
        className,
      )}
    >
      <Download className="h-4 w-4" /> Installer l'application
    </button>
  );
}
