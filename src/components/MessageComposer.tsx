import { SendHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MESSAGE_COUNTER_FROM,
  MESSAGE_MAX_LENGTH,
  isMessageSendable,
  normalizeMessage,
  readDraft,
  saveDraft,
} from "@/features/messaging/composer";
import { cn } from "@/lib/utils";

const numberFormat = new Intl.NumberFormat("fr-FR");

interface MessageComposerProps {
  userId: string;
  conversationId: string;
  otherName: string;
  /**
   * Envoi du texte (déjà nettoyé des espaces de début et de fin). Renvoie `true` si le
   * message est parti : le brouillon est alors effacé ; sinon le texte revient dans le champ.
   */
  onSend: (text: string) => Promise<boolean>;
}

/** Champ de saisie et bouton « Envoyer » d'un message. */
export function MessageComposer({
  userId,
  conversationId,
  otherName,
  onSend,
}: MessageComposerProps) {
  const [text, setText] = useState(() => readDraft(userId, conversationId));
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const counterId = useId();

  // Le champ s'agrandit avec le texte (jusqu'à environ 6 lignes, puis défile).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const length = text.length;
  const atLimit = length >= MESSAGE_MAX_LENGTH;
  const canSend = isMessageSendable(text) && !sending;

  async function send() {
    // Un seul envoi à la fois (double clic, Ctrl+Entrée répété).
    if (sendingRef.current || !isMessageSendable(text)) return;
    sendingRef.current = true;
    setSending(true);
    // Le champ se vide aussitôt (le message s'affiche dans le fil) ; si l'envoi échoue, le
    // texte est remis dans le champ.
    const draft = text;
    setText("");
    let sent = false;
    try {
      sent = await onSend(normalizeMessage(draft));
    } finally {
      if (sent) saveDraft(userId, conversationId, "");
      else setText((current) => current || draft);
      sendingRef.current = false;
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  return (
    <form
      className="panel sticky bottom-24 z-30 space-y-1.5 p-3"
      aria-label={`Écrire à ${otherName}`}
      data-testid="message-composer"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <label htmlFor="message-input" className="sr-only">
        Votre message à {otherName}
      </label>
      <div className="flex items-end gap-2">
        <Textarea
          id="message-input"
          ref={textareaRef}
          rows={1}
          maxLength={MESSAGE_MAX_LENGTH}
          readOnly={sending}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            saveDraft(userId, conversationId, e.target.value);
          }}
          placeholder={`Écrivez à ${otherName}…`}
          autoComplete="off"
          enterKeyHint="enter"
          onKeyDown={(e) => {
            // Entrée : nouvelle ligne ; Ctrl+Entrée (ou Cmd+Entrée) : envoyer.
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void send();
            }
          }}
          aria-describedby={length >= MESSAGE_COUNTER_FROM ? counterId : undefined}
          className="max-h-40 min-h-10 resize-none rounded-2xl bg-background/60"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          aria-label={sending ? "Envoi du message…" : "Envoyer le message"}
          title="Envoyer (Ctrl+Entrée)"
          onClick={(e) => {
            // Double clic : seul le premier clic envoie.
            if (e.detail > 1) e.preventDefault();
          }}
          className="size-10 shrink-0 rounded-full"
        >
          <SendHorizontal className={cn("size-4", sending && "animate-pulse")} aria-hidden />
        </Button>
      </div>
      {length >= MESSAGE_COUNTER_FROM ? (
        <p
          id={counterId}
          aria-live="polite"
          className={cn(
            "text-right text-[11px]",
            atLimit ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {numberFormat.format(length)} / {numberFormat.format(MESSAGE_MAX_LENGTH)}
          {atLimit ? " — limite atteinte" : ""}
        </p>
      ) : null}
    </form>
  );
}
