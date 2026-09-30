import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  REPORT_DESCRIPTION_MAX,
  REPORT_REASONS,
  reportUser,
  type ReportReason,
} from "@/features/safety/moderation";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  name: string;
  /** Présent quand on signale un message précis (22.2). */
  messageId?: string;
}

/** 22.1 à 22.3 — Signalement d'un profil ou d'un message : motif obligatoire. */
export function ReportDialog({ open, onOpenChange, userId, name, messageId }: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState("");

  const report = useMutation({
    mutationFn: () => {
      if (!reason) throw new Error("Choisissez un motif.");
      return reportUser({ userId, reason, description, ...(messageId ? { messageId } : {}) });
    },
    onSuccess: () => {
      toast.success("Merci. Votre signalement a été transmis à l'équipe de modération.");
      setReason(null);
      setDescription("");
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !report.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-md" data-testid="report-dialog">
        <DialogHeader>
          <DialogTitle>{messageId ? "Signaler ce message" : `Signaler ${name}`}</DialogTitle>
          <DialogDescription>
            Votre signalement reste anonyme. L'équipe YONA l'examinera rapidement.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            report.mutate();
          }}
        >
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Motif</legend>
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="accent-gold"
                />
                {r.label}
              </label>
            ))}
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="report-description">Précisions (facultatif)</Label>
            <Textarea
              id="report-description"
              value={description}
              maxLength={REPORT_DESCRIPTION_MAX}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          {report.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {report.error.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={report.isPending}
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!reason || report.isPending}
              data-testid="report-submit"
            >
              {report.isPending ? "Envoi…" : "Envoyer le signalement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
