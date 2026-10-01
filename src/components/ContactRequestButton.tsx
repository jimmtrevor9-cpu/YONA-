import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Send, Zap } from "lucide-react";
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
import { useAuth } from "@/features/auth/AuthProvider";
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  contactQuotaLabel,
  contactRequestErrorMessage,
  contactRequestQuotaQuery,
  isContactPhoneError,
  isDailyLimitError,
  sendContactRequest,
} from "@/features/contacts/requests";

/** Bouton « Demande de contact » et fenêtre d'envoi (message facultatif). */
export function ContactRequestButton({
  receiverId,
  receiverName,
}: {
  receiverId: string;
  receiverName: string;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const tooLong = message.trim().length > CONTACT_MESSAGE_MAX_LENGTH;
  // Quota du jour (étape 12.4) : lu à l'ouverture de la fenêtre, recalculé par le serveur.
  const { data: quota } = useQuery({
    ...contactRequestQuotaQuery(userId),
    enabled: open && !!userId,
  });
  const exhausted = !!quota && !quota.unlimited && (quota.remaining ?? 0) <= 0;
  // Message Flash : proposé aux Premium (quota illimité = Premium), message obligatoire.
  const canFlash = !!quota?.unlimited;
  const flashMissingMessage = flash && message.trim().length === 0;
  const refreshQuota = () => queryClient.invalidateQueries({ queryKey: ["contact-requests"] });

  const send = useMutation({
    mutationFn: () => sendContactRequest(receiverId, message, flash && canFlash),
    onSuccess: (result) => {
      if (result.status === "already_pending") {
        toast.info(`Vous avez déjà une demande de contact en attente pour ${receiverName}.`);
      } else {
        toast.success(
          flash
            ? `Message Flash envoyé à ${receiverName} : il sera mis en avant.`
            : `Demande de contact envoyée à ${receiverName}.`,
        );
      }
      setMessage("");
      setNotice(null);
      setFlash(false);
      setOpen(false);
      void refreshQuota();
    },
    onError: (error) => {
      if (isContactPhoneError(error) || isDailyLimitError(error)) {
        setNotice(contactRequestErrorMessage(error));
      }
      toast.error(contactRequestErrorMessage(error));
      void refreshQuota();
    },
  });

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Envoyer une demande de contact à ${receiverName}`}
        data-testid="contact-request-button"
      >
        <Send aria-hidden />
        Demande de contact
      </Button>
      <Dialog open={open} onOpenChange={(next) => !send.isPending && setOpen(next)}>
        <DialogContent className="max-w-md" data-testid="contact-request-dialog">
          <DialogHeader>
            <DialogTitle>Demande de contact à {receiverName}</DialogTitle>
            <DialogDescription>
              {receiverName} pourra accepter ou refuser votre demande. Présentez-vous en quelques
              mots si vous le souhaitez.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (tooLong || flashMissingMessage || send.isPending) return;
              send.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`contact-message-${receiverId}`}>
                {flash ? "Message (obligatoire pour un Flash)" : "Message (facultatif)"}
              </Label>
              <Textarea
                id={`contact-message-${receiverId}`}
                rows={4}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setNotice(null);
                }}
                aria-invalid={tooLong || !!notice}
                aria-describedby={`contact-message-help-${receiverId}`}
              />
              <p
                id={`contact-message-help-${receiverId}`}
                className={tooLong ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
                data-testid="contact-message-count"
              >
                {message.trim().length} / {CONTACT_MESSAGE_MAX_LENGTH} caractères
              </p>
              {notice ? (
                <p className="text-xs text-destructive" role="alert" data-testid="contact-notice">
                  {notice}
                </p>
              ) : null}
            </div>
            {quota && canFlash ? (
              <label
                className="flex cursor-pointer items-start gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-foreground"
                data-testid="flash-toggle"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-[var(--color-gold)]"
                  checked={flash}
                  onChange={(e) => setFlash(e.target.checked)}
                />
                <span>
                  <span className="flex items-center gap-1 font-medium text-gold">
                    <Zap className="size-3.5" aria-hidden />
                    Envoyer en Message Flash
                  </span>
                  Votre demande et votre message apparaissent en tête, mis en avant.
                </span>
              </label>
            ) : quota ? (
              <p className="text-[11px] text-muted-foreground" data-testid="flash-locked">
                <Zap className="mr-1 inline size-3 text-gold" aria-hidden />
                Message Flash mis en avant :{" "}
                <Link to="/premium" className="text-gold underline-offset-2 hover:underline">
                  avec Premium
                </Link>
              </p>
            ) : null}
            {quota ? (
              <div
                className={
                  exhausted
                    ? "rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                    : "rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted-foreground"
                }
                data-testid="contact-quota"
                aria-live="polite"
              >
                {contactQuotaLabel(quota)}
                {exhausted ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link to="/premium" className="font-medium underline underline-offset-2">
                      Premium : demandes illimitées
                    </Link>
                  </>
                ) : null}
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={send.isPending}
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="gold"
                disabled={tooLong || exhausted || flashMissingMessage || send.isPending}
              >
                {send.isPending ? "Envoi…" : flash ? "Envoyer le Flash" : "Envoyer la demande"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
