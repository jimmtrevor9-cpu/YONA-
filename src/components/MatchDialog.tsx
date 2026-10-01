import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MatchDialogProps {
  /** Prénom de la personne avec qui le Match vient d'avoir lieu ; `null` = fenêtre fermée. */
  firstName: string | null;
  onClose: () => void;
}

/** Annonce d'un nouveau Match, affichée juste après le Like réciproque. */
export function MatchDialog({ firstName, onClose }: MatchDialogProps) {
  return (
    <Dialog open={firstName !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent
        className="panel gold-thread w-[calc(100%-2.5rem)] max-w-sm border-0 bg-surface p-7 text-center"
        data-testid="match-dialog"
      >
        <DialogHeader className="items-center space-y-3 text-center sm:text-center">
          <span className="grid size-14 place-items-center rounded-full bg-accent ring-1 ring-gold/20">
            <Heart className="size-6 fill-current text-gold-soft" aria-hidden />
          </span>
          <p className="eyebrow">Nouveau Match</p>
          <DialogTitle className="font-display text-2xl font-semibold text-foreground">
            C'est un Match !
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Vous et {firstName ?? "cette personne"} vous êtes aimés mutuellement.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button type="button" variant="gold" className="w-full" onClick={onClose}>
            Continuer à découvrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
