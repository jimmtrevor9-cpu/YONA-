import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Crown, SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/AuthProvider";
import { aiQuotaLabel, aiQuotaQuery } from "@/features/ai/queries";
import {
  ROI_SALOMON_QUESTION_MAX,
  askRoiSalomon,
  getRoiSalomonAvailability,
  roiSalomonErrorMessage,
} from "@/features/ai/roi-salomon.functions";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/roi-salomon")({
  head: () => ({
    meta: [
      { title: `Roi Salomon — ${APP_NAME}` },
      {
        name: "description",
        content: "Posez vos questions sur les rencontres et la vie de couple chrétienne.",
      },
    ],
  }),
  component: RoiSalomonPage,
});

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Idées de questions proposées quand la discussion est vide. */
const SUGGESTIONS = [
  "Comment bien rédiger ma présentation ?",
  "Comment engager une première conversation avec respect ?",
  "Comment préparer une première rencontre en toute sécurité ?",
  "Comment savoir si une relation vient de Dieu ?",
];

// La discussion est gardée dans l'onglet (sessionStorage) : elle survit à un rechargement
// mais disparaît à la fermeture. Aucune donnée n'est enregistrée sur le serveur.
const storageKey = (userId: string) => `yona:roi-salomon:${userId}`;
function readHistory(userId: string): ChatTurn[] {
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as ChatTurn[]) : [];
  } catch {
    return [];
  }
}
function saveHistory(userId: string, turns: ChatTurn[]) {
  try {
    sessionStorage.setItem(storageKey(userId), JSON.stringify(turns.slice(-40)));
  } catch {
    // Stockage indisponible (navigation privée…) : la discussion reste en mémoire.
  }
}

/** Page Roi Salomon : discussion avec l'assistant IA. */
function RoiSalomonPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const ask = useServerFn(askRoiSalomon);
  const availabilityFn = useServerFn(getRoiSalomonAvailability);
  const { data: availability } = useQuery({
    queryKey: ["ai", "availability"],
    queryFn: () => availabilityFn(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: quota } = useQuery({ ...aiQuotaQuery(userId, "roi_salomon"), enabled: !!userId });
  const [turns, setTurns] = useState<ChatTurn[]>(() => readHistory(userId));
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, sending]);

  const exhausted = !!quota && !quota.unlimited && (quota.remaining ?? 0) <= 0;
  const unavailable = availability?.available === false;
  const tooLong = question.trim().length > ROI_SALOMON_QUESTION_MAX;
  const canSend = !!question.trim() && !tooLong && !sending && !exhausted && !unavailable;

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    const history = turns;
    const next = [...history, { role: "user" as const, content }];
    setTurns(next);
    setQuestion("");
    setSending(true);
    try {
      const result = await ask({ data: { question: content, history } });
      const withAnswer = [...next, { role: "assistant" as const, content: result.answer }];
      setTurns(withAnswer);
      saveHistory(userId, withAnswer);
      queryClient.setQueryData(aiQuotaQuery(userId, "roi_salomon").queryKey, result.quota);
    } catch (error) {
      // Question refusée : elle revient dans le champ, rien n'est ajouté à la discussion.
      setTurns(history);
      setQuestion(content);
      toast.error(roiSalomonErrorMessage(error), { duration: 8000 });
      void queryClient.invalidateQueries({ queryKey: ["ai", "quota"] });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Roi Salomon" />
      <main className="mx-auto max-w-md space-y-4 px-5 py-6" data-testid="roi-salomon-page">
        <section className="panel gold-thread flex items-start gap-3 p-4">
          <Crown className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
          <div className="space-y-1">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Votre conseiller Roi Salomon
            </h2>
            <p className="text-xs text-muted-foreground">
              Posez vos questions sur les rencontres, la foi et la vie de couple. Ses réponses sont
              générées par une intelligence artificielle : gardez votre discernement.
            </p>
          </div>
        </section>

        {unavailable ? (
          <p className="panel-2 p-4 text-sm text-muted-foreground" data-testid="ai-unavailable">
            Roi Salomon n'est pas encore disponible. Revenez bientôt.
          </p>
        ) : null}

        <section
          className="panel min-h-60 space-y-3 p-4"
          aria-label="Discussion avec Roi Salomon"
          aria-live="polite"
          data-testid="ai-thread"
        >
          {turns.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Quelques idées pour commencer :</p>
              <ul className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      disabled={exhausted || unavailable || sending}
                      onClick={() => void send(s)}
                      className="w-full rounded-xl bg-surface-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            turns.map((turn, index) => (
              <div
                key={index}
                data-testid={turn.role === "user" ? "ai-question" : "ai-answer"}
                className={cn(
                  "max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                  turn.role === "user"
                    ? "ml-auto bg-gold text-primary-foreground"
                    : "mr-auto bg-surface-2 text-foreground",
                )}
              >
                {turn.content}
              </div>
            ))
          )}
          {sending ? (
            <p className="text-xs text-muted-foreground" data-testid="ai-thinking">
              Roi Salomon réfléchit…
            </p>
          ) : null}
          <div ref={endRef} />
        </section>

        <form
          className="panel sticky bottom-24 z-30 space-y-1.5 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) void send(question);
          }}
          data-testid="ai-form"
        >
          <label htmlFor="ai-question" className="sr-only">
            Votre question à Roi Salomon
          </label>
          <div className="flex items-end gap-2">
            <Textarea
              id="ai-question"
              rows={2}
              value={question}
              disabled={exhausted || unavailable}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  if (canSend) void send(question);
                }
              }}
              placeholder={
                exhausted ? "Questions gratuites utilisées aujourd'hui" : "Posez votre question…"
              }
              className="max-h-40 min-h-10 resize-none rounded-2xl bg-background/60"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!canSend}
              aria-label="Envoyer la question"
              className="size-10 shrink-0 rounded-full"
            >
              <SendHorizontal className={cn("size-4", sending && "animate-pulse")} aria-hidden />
            </Button>
          </div>
          {tooLong ? (
            <p className="text-right text-[11px] text-destructive">
              {question.trim().length} / {ROI_SALOMON_QUESTION_MAX} caractères
            </p>
          ) : null}
          {quota ? (
            <p
              className={cn(
                "text-center text-[11px]",
                exhausted ? "font-medium text-destructive" : "text-muted-foreground",
              )}
              data-testid="ai-quota"
            >
              {aiQuotaLabel(quota)}
              {exhausted ? " · Premium : questions illimitées" : null}
            </p>
          ) : null}
        </form>
      </main>
      <BottomNav />
    </div>
  );
}
