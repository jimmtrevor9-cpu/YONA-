import { useEffect, useId, useRef, useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import {
  MESSAGE_COUNTER_FROM,
  MESSAGE_MAX_LENGTH,
  readDraft,
  saveDraft,
} from "@/features/messaging/composer";
import { cn } from "@/lib/utils";

const numberFormat = new Intl.NumberFormat("fr-FR");

interface MessageComposerProps {
  userId: string;
  conversationId: string;
  otherName: string;
}

/** Champ de saisie d'un message (l'envoi arrive à l'étape suivante). */
export function MessageComposer({ userId, conversationId, otherName }: MessageComposerProps) {
  const [text, setText] = useState(() => readDraft(userId, conversationId));
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

  return (
    <form
      className="panel sticky bottom-24 z-30 space-y-1.5 p-3"
      aria-label={`Écrire à ${otherName}`}
      data-testid="message-composer"
      onSubmit={(e) => e.preventDefault()}
    >
      <label htmlFor="message-input" className="sr-only">
        Votre message à {otherName}
      </label>
      <Textarea
        id="message-input"
        ref={textareaRef}
        rows={1}
        maxLength={MESSAGE_MAX_LENGTH}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          saveDraft(userId, conversationId, e.target.value);
        }}
        placeholder={`Écrivez à ${otherName}…`}
        autoComplete="off"
        aria-describedby={length >= MESSAGE_COUNTER_FROM ? counterId : undefined}
        className="max-h-40 min-h-10 resize-none rounded-2xl bg-background/60"
      />
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
