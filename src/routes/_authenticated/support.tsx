import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/AuthProvider";
import { myPremiumQuery } from "@/features/premium/queries";
import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_SUBJECT_MAX,
  TICKET_STATUS_LABELS,
  createSupportTicket,
  mySupportTicketsQuery,
} from "@/features/support/tickets";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: `Support — ${APP_NAME}` },
      { name: "description", content: "Contactez l'équipe YONA." },
    ],
  }),
  component: SupportPage,
});

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

/** 15.16 — Support : envoyer une demande et suivre ses réponses. Priorité pour les Premium. */
function SupportPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const { data: premium } = useQuery({ ...myPremiumQuery(userId), enabled: !!userId });
  const { data: tickets, isLoading } = useQuery({
    ...mySupportTicketsQuery(userId),
    enabled: !!userId,
  });
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const create = useMutation({
    mutationFn: () => createSupportTicket(subject, message),
    onSuccess: () => {
      toast.success("Demande envoyée. Nous vous répondrons ici.");
      setSubject("");
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["support", "mine"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
  });
  const canSend = subject.trim().length >= 3 && message.trim().length >= 10 && !create.isPending;

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Support" />
      <main className="mx-auto max-w-md space-y-5 px-5 py-6" data-testid="support-page">
        {premium?.premium ? (
          <p
            className="panel-2 flex items-center gap-2 p-4 text-xs text-gold-soft"
            data-testid="support-priority"
          >
            <Zap className="size-4 shrink-0 text-gold" aria-hidden />
            Support prioritaire 7j/7 : vos demandes passent en premier.
          </p>
        ) : (
          <p className="panel-2 p-4 text-xs text-muted-foreground" data-testid="support-standard">
            Nous répondons à chaque demande.{" "}
            <Link to="/premium" className="text-gold underline-offset-2 hover:underline">
              Premium : support prioritaire 7j/7
            </Link>
          </p>
        )}

        <form
          className="panel gold-thread space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) create.mutate();
          }}
        >
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            <LifeBuoy className="size-5 text-gold" aria-hidden />
            Nouvelle demande
          </p>
          <div className="space-y-2">
            <Label htmlFor="support-subject">Sujet</Label>
            <Input
              id="support-subject"
              maxLength={SUPPORT_SUBJECT_MAX}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex. : problème de paiement"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-message">Votre message</Label>
            <Textarea
              id="support-message"
              rows={5}
              maxLength={SUPPORT_MESSAGE_MAX}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Décrivez votre demande (10 caractères au moins)."
            />
          </div>
          <Button type="submit" className="w-full" disabled={!canSend}>
            {create.isPending ? "Envoi…" : "Envoyer la demande"}
          </Button>
        </form>

        <section className="space-y-3" aria-labelledby="tickets-title">
          <p id="tickets-title" className="eyebrow">
            Mes demandes
          </p>
          {isLoading ? (
            <Skeleton className="h-20 w-full rounded-2xl" />
          ) : tickets?.length ? (
            <ul className="space-y-3" data-testid="support-tickets">
              {tickets.map((t) => (
                <li key={t.id} className="panel space-y-2 p-4" data-testid="support-ticket">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="flex-1 text-sm font-medium text-foreground">{t.subject}</p>
                    {t.priority === "priority" ? (
                      <Badge variant="gold" data-testid="ticket-priority">
                        Prioritaire
                      </Badge>
                    ) : null}
                    <Badge variant="subtle">{TICKET_STATUS_LABELS[t.status]}</Badge>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                    {t.message}
                  </p>
                  {t.adminReply ? (
                    <p className="panel-2 whitespace-pre-wrap break-words p-3 text-xs text-foreground">
                      <span className="font-medium">Réponse de l'équipe : </span>
                      {t.adminReply}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    {dateFormat.format(new Date(t.createdAt))}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel p-5 text-sm text-muted-foreground" data-testid="support-empty">
              Aucune demande pour le moment.
            </p>
          )}
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
