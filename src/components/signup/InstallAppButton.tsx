import { Download, Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  INSTALL_PROMPT_CHANGED,
  clearInstallPrompt,
  getInstallPrompt,
  isIos,
  isStandalone,
} from "@/lib/pwa";
import { cn } from "@/lib/utils";

/**
 * « Installer l'application » :
 * - si le navigateur le permet (Android, Chrome, Edge…), la fenêtre d'installation
 *   s'ouvre directement ;
 * - sinon (iPhone, Safari, Firefox…), une courte aide explique comment ajouter YONA
 *   à l'écran d'accueil.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const [installed, setInstalled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setIos(isIos());
    if (isStandalone()) setInstalled(true);
    const onChange = () => {
      if (isStandalone()) setInstalled(true);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener(INSTALL_PROMPT_CHANGED, onChange);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener(INSTALL_PROMPT_CHANGED, onChange);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    const promptEvent = getInstallPrompt();
    if (!promptEvent) {
      setHelpOpen(true);
      return;
    }
    // La fenêtre d'installation du navigateur ne peut servir qu'une fois.
    clearInstallPrompt();
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setInstalled(true);
  }

  return (
    <>
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

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-sm text-center" data-testid="install-help">
          <DialogHeader className="items-center text-center">
            <DialogTitle className="font-display">Installer YONA</DialogTitle>
            <DialogDescription>
              {ios
                ? "Sur iPhone et iPad, l'installation se fait depuis Safari, en deux gestes :"
                : "Votre navigateur ne propose pas l'installation automatique. Deux gestes suffisent :"}
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-left text-sm text-foreground">
            <li className="flex items-start gap-3 rounded-xl border border-border p-3">
              <Share className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                {ios ? (
                  <>
                    Touchez le bouton <strong>Partager</strong> en bas de l'écran.
                  </>
                ) : (
                  <>
                    Ouvrez le <strong>menu du navigateur</strong> (⋮ ou ⋯).
                  </>
                )}
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-xl border border-border p-3">
              <SquarePlus className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                {ios ? (
                  <>
                    Choisissez <strong>Sur l'écran d'accueil</strong>, puis <strong>Ajouter</strong>
                    .
                  </>
                ) : (
                  <>
                    Choisissez <strong>Installer l'application</strong> ou{" "}
                    <strong>Ajouter à l'écran d'accueil</strong>.
                  </>
                )}
              </span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
