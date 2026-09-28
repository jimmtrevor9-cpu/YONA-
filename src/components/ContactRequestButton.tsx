import { useMutation } from "@tanstack/react-query";
import { Send } from "lucide-react";
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
  CONTACT_MESSAGE_MAX_LENGTH,
  contactRequestErrorMessage,
  isContactPhoneError,
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
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const tooLong = message.trim().length > CONTACT_MESSAGE_MAX_LENGTH;

  const send = useMutation({
    mutationFn: () => sendContactRequest(receiverId, message),
    onSuccess: (result) => {
      if (result.status === "already_pending") {
        toast.info(`Vous avez déjà une demande de contact en attente pour ${receiverName}.`);
      } else {
        toast.success(`Demande de contact envoyée à ${receiverName}.`);
      }
      setMessage("");
      setNotice(null);
      setOpen(false);
    },
    onError: (error) => {
      if (isContactPhoneError(error)) setNotice(contactRequestErrorMessage(error));
      toast.error(contactRequestErrorMessage(error));
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
              if (tooLong || send.isPending) return;
              send.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`contact-message-${receiverId}`}>Message (facultatif)</Label>
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
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={send.isPending}
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" variant="gold" disabled={tooLong || send.isPending}>
                {send.isPending ? "Envoi…" : "Envoyer la demande"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
