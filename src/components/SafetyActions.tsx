import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Ban, Flag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ReportDialog } from "@/components/ReportDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { blockUser } from "@/features/safety/moderation";

interface SafetyActionsProps {
  userId: string;
  name: string;
  /** "compact" : icônes seules (en-tête de conversation). */
  variant?: "full" | "compact";
}

/** 21.1 et 22.1 — Boutons « Signaler » et « Bloquer » sur un profil ou une conversation. */
export function SafetyActions({ userId, name, variant = "full" }: SafetyActionsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

  const block = useMutation({
    mutationFn: () => blockUser(userId),
    onSuccess: async () => {
      setBlockOpen(false);
      toast.success(`${name} est bloqué(e). Vous ne verrez plus son profil.`);
      await queryClient.invalidateQueries();
      void navigate({ to: "/matches" });
    },
  });

  const compact = variant === "compact";
  return (
    <div
      className={compact ? "flex items-center gap-1" : "grid grid-cols-2 gap-2"}
      data-testid="safety-actions"
    >
      <Button
        type="button"
        variant="ghost"
        size={compact ? "icon" : "sm"}
        onClick={() => setReportOpen(true)}
        aria-label={`Signaler ${name}`}
        data-testid="report-open"
      >
        <Flag aria-hidden />
        {compact ? null : "Signaler"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size={compact ? "icon" : "sm"}
        onClick={() => setBlockOpen(true)}
        aria-label={`Bloquer ${name}`}
        data-testid="block-open"
        className="text-destructive hover:text-destructive"
      >
        <Ban aria-hidden />
        {compact ? null : "Bloquer"}
      </Button>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} userId={userId} name={name} />

      <Dialog open={blockOpen} onOpenChange={(o) => !block.isPending && setBlockOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bloquer {name} ?</DialogTitle>
            <DialogDescription>
              Vous ne verrez plus son profil et vous ne pourrez plus vous écrire. Votre Match et la
              conversation seront fermés. Vous pourrez le débloquer dans les Paramètres.
            </DialogDescription>
          </DialogHeader>
          {block.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {block.error.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={block.isPending}
              onClick={() => setBlockOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={block.isPending}
              onClick={() => block.mutate()}
              data-testid="block-confirm"
            >
              {block.isPending ? "Blocage…" : "Bloquer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
