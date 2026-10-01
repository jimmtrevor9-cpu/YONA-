import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  generateIceBreaker,
  iceBreakerErrorMessage,
} from "@/features/icebreaker/icebreaker.functions";
import { ICE_BREAKER_PAGE, iceBreakerSuggestions } from "@/features/icebreaker/suggestions";
import { supabase } from "@/integrations/supabase/client";

interface IceBreakerBarProps {
  conversationId: string;
  otherUserId: string;
  otherName: string;
  premium: boolean;
  /** Place le texte choisi dans le champ de message (il reste modifiable avant l'envoi). */
  insert: (text: string) => void;
}

/** Idées de premier message (16.1 à 16.4), au-dessus du champ de message. */
export function IceBreakerBar({
  conversationId,
  otherUserId,
  otherName,
  premium,
  insert,
}: IceBreakerBarProps) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const { data: interest } = useQuery({
    queryKey: ["icebreaker", "interest", otherUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("interests")
        .eq("user_id", otherUserId)
        .maybeSingle();
      return data?.interests?.[0] ?? null;
    },
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });
  const generate = useServerFn(generateIceBreaker);
  const personal = useMutation({
    mutationFn: () => generate({ data: { conversationId } }),
    onSuccess: (result) => {
      insert(result.suggestion);
      setOpen(false);
    },
    onError: (error) => toast.error(iceBreakerErrorMessage(error)),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-1 text-xs text-gold-soft hover:text-gold"
        data-testid="icebreaker-open"
      >
        <Lightbulb className="size-3.5" aria-hidden />
        Idées pour engager la conversation
      </button>
    );
  }

  const all = iceBreakerSuggestions({ firstName: otherName, interest: interest ?? null });
  const start = (page * ICE_BREAKER_PAGE) % all.length;
  const shown = [...all, ...all].slice(start, start + ICE_BREAKER_PAGE);

  return (
    <div className="space-y-2" data-testid="icebreaker-bar">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Lightbulb className="size-3.5 text-gold" aria-hidden />
          Ice Breaker
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setPage((p) => p + 1)}
          >
            <RefreshCw className="size-3" aria-hidden />
            Autres idées
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setOpen(false)}
          >
            Fermer
          </Button>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {shown.map((text) => (
          <li key={text}>
            <button
              type="button"
              onClick={() => {
                insert(text);
                setOpen(false);
              }}
              className="w-full rounded-xl bg-surface-2 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-accent"
              data-testid="icebreaker-suggestion"
            >
              {text}
            </button>
          </li>
        ))}
      </ul>
      {premium ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full border border-gold/40 text-xs"
          disabled={personal.isPending}
          onClick={() => personal.mutate()}
          data-testid="icebreaker-personal"
        >
          <Sparkles className="size-3.5 text-gold" aria-hidden />
          {personal.isPending ? "Création de votre message…" : "Suggestion personnalisée (IA)"}
        </Button>
      ) : (
        <p
          className="text-center text-[11px] text-muted-foreground"
          data-testid="icebreaker-locked"
        >
          <Sparkles className="mr-1 inline size-3 text-gold" aria-hidden />
          Message personnalisé selon son profil :{" "}
          <Link to="/premium" className="text-gold underline-offset-2 hover:underline">
            avec Premium
          </Link>
        </p>
      )}
    </div>
  );
}
