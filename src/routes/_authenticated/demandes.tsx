import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, MapPin, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  CONTACT_STATUS_LABELS,
  cancelContactRequest,
  contactQuotaLabel,
  contactRequestErrorMessage,
  contactRequestQuotaQuery,
  contactRequestsQuery,
  respondContactRequest,
  type ContactRequestDirection,
  type ContactRequestItem,
} from "@/features/contacts/requests";
import { computeAge } from "@/features/profiles/queries";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/demandes")({
  head: () => ({
    meta: [
      { title: `Demandes de contact — ${APP_NAME}` },
      { name: "description", content: "Vos demandes de contact reçues et envoyées." },
    ],
  }),
  component: ContactRequestsPage,
});

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

/** Page des demandes de contact : reçues (accepter / refuser) et envoyées (annuler). */
function ContactRequestsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { data: quota } = useQuery({ ...contactRequestQuotaQuery(userId), enabled: !!userId });

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Demandes de contact" />
      <main className="mx-auto max-w-md space-y-4 px-5 py-6" data-testid="contact-requests-page">
        {quota ? (
          <p
            className="panel-2 px-4 py-3 text-xs text-muted-foreground"
            data-testid="contact-quota"
          >
            {contactQuotaLabel(quota)}
          </p>
        ) : null}
        <Tabs defaultValue="received">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="received">Reçues</TabsTrigger>
            <TabsTrigger value="sent">Envoyées</TabsTrigger>
          </TabsList>
          <TabsContent value="received" className="mt-4">
            <RequestList userId={userId} direction="received" />
          </TabsContent>
          <TabsContent value="sent" className="mt-4">
            <RequestList userId={userId} direction="sent" />
          </TabsContent>
        </Tabs>
      </main>
      <BottomNav />
    </div>
  );
}

function RequestList({
  userId,
  direction,
}: {
  userId: string;
  direction: ContactRequestDirection;
}) {
  const { data, isLoading, isError } = useQuery({
    ...contactRequestsQuery(userId, direction),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Les demandes n'ont pas pu être chargées. Réessayez dans un instant.
      </p>
    );
  }
  if (!data?.length) {
    return (
      <div className="panel space-y-4 p-6 text-center" data-testid={`requests-empty-${direction}`}>
        <p className="text-sm text-muted-foreground">
          {direction === "received"
            ? "Vous n'avez reçu aucune demande de contact pour le moment."
            : "Vous n'avez envoyé aucune demande de contact."}
        </p>
        {direction === "sent" ? (
          <Button asChild size="sm" variant="secondary">
            <Link to="/search">Rechercher des profils</Link>
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <ul className="space-y-3" aria-label={direction === "received" ? "Reçues" : "Envoyées"}>
      {data.map((item) => (
        <RequestCard key={item.id} item={item} direction={direction} />
      ))}
    </ul>
  );
}

function RequestCard({
  item,
  direction,
}: {
  item: ContactRequestItem;
  direction: ContactRequestDirection;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const name = item.firstName ?? "Membre";
  const age = computeAge(item.birthDate);
  const place = [item.city, item.country].filter(Boolean).join(", ");
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["contact-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["matches"] });
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const respond = useMutation({
    mutationFn: (accept: boolean) => respondContactRequest(item.id, accept),
    onSuccess: (result) => {
      refresh();
      if (result.status === "accepted") {
        toast.success(`Vous êtes maintenant en contact avec ${name} : c'est un Match !`);
        if (result.conversation_id) {
          void navigate({
            to: "/messages/$conversationId",
            params: { conversationId: result.conversation_id },
          });
        }
      } else {
        toast.info("Demande refusée.");
      }
    },
    onError: (error) => {
      toast.error(contactRequestErrorMessage(error));
      refresh();
    },
  });
  const cancel = useMutation({
    mutationFn: () => cancelContactRequest(item.id),
    onSuccess: () => {
      toast.info("Demande annulée.");
      refresh();
    },
    onError: (error) => {
      toast.error(contactRequestErrorMessage(error));
      refresh();
    },
  });
  const pending = item.status === "pending";
  const busy = respond.isPending || cancel.isPending;

  return (
    <li
      className={cn(
        "panel gold-thread space-y-3 p-4",
        item.isFlash && pending && "ring-1 ring-gold",
      )}
      data-testid="contact-request-item"
    >
      <div className="flex items-center gap-4">
        <Avatar className="size-14 ring-1 ring-gold/20">
          {item.photoUrl ? (
            <AvatarImage src={item.photoUrl} alt={`Photo de ${name}`} className="object-cover" />
          ) : null}
          <AvatarFallback className="bg-accent font-display text-lg text-gold-soft">
            {name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-semibold text-foreground">
            {name}
            {age ? <span className="text-muted-foreground"> · {age} ans</span> : null}
          </h2>
          {place ? (
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {place}
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {item.isFlash ? (
              <span
                className="mr-1 inline-flex items-center gap-1 font-medium text-gold"
                data-testid="flash-badge"
              >
                <Sparkles className="size-3" aria-hidden />
                Message Flash ·
              </span>
            ) : null}
            {direction === "received" ? "Reçue" : "Envoyée"} le{" "}
            {dateFormat.format(new Date(item.createdAt))} ·{" "}
            <span data-testid="contact-request-status">{CONTACT_STATUS_LABELS[item.status]}</span>
          </p>
        </div>
      </div>
      {item.message ? (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-foreground">
          « {item.message} »
        </p>
      ) : null}
      {pending && direction === "received" ? (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => respond.mutate(false)}
            aria-label={`Refuser la demande de ${name}`}
          >
            <X aria-hidden />
            Refuser
          </Button>
          <Button
            type="button"
            size="sm"
            variant="gold"
            disabled={busy}
            onClick={() => respond.mutate(true)}
            aria-label={`Accepter la demande de ${name}`}
          >
            <Check aria-hidden />
            {respond.isPending ? "Envoi…" : "Accepter"}
          </Button>
        </div>
      ) : null}
      {pending && direction === "sent" ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => cancel.mutate()}
            aria-label={`Annuler la demande envoyée à ${name}`}
          >
            Annuler la demande
          </Button>
        </div>
      ) : null}
    </li>
  );
}
