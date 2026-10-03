import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { AdsTab } from "@/components/admin/AdsTab";
import { DemoProfilesTab } from "@/components/admin/DemoProfilesTab";
import { LogsTab } from "@/components/admin/LogsTab";
import { MembersTable } from "@/components/admin/MembersTable";
import { StatsTab } from "@/components/admin/StatsTab";
import { DeleteMemberSection, UserHistory } from "@/components/admin/UserHistory";
import { UserLocation } from "@/components/admin/UserLocation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { adminSetUserStatus } from "@/features/admin/admin.functions";
import {
  adminPaymentsQuery,
  adminPhotosQuery,
  adminReportsQuery,
  adminSubscriptionsQuery,
  adminTicketsQuery,
  adminUnlocksQuery,
  adminUserDetailQuery,
  adminVerificationsQuery,
  formatMoney,
  moderatePhoto,
  replyTicket,
  resolveReport,
  reviewVerification,
} from "@/features/admin/queries";
import { useAuth } from "@/features/auth/AuthProvider";
import { isAdminQuery } from "@/features/auth/roles";
import { REPORT_REASONS } from "@/features/safety/moderation";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: `Administration — ${APP_NAME}` }] }),
  component: AdminPage,
});

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
const fmt = (iso: string | null | undefined) => (iso ? dateFormat.format(new Date(iso)) : "—");
const reasonLabel = (r: string) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;
const STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  suspended: "Suspendu",
  disabled: "Banni",
  deleted: "Supprimé",
};

/**
 * 23.1 / 23.2 — Espace d'administration. La page vérifie le rôle pour l'affichage, mais la
 * vraie protection est en base : chaque fonction `admin_*` refuse un non-admin.
 */
function AdminPage() {
  const { user } = useAuth();
  const { data: isAdmin, isLoading } = useQuery({
    ...isAdminQuery(user?.id ?? ""),
    enabled: !!user?.id,
  });
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [tab, setTab] = useState("dashboard");

  if (isLoading) return null;
  if (!isAdmin) return <Navigate to="/discover" replace />;

  return (
    <div className="min-h-screen bg-background pb-12">
      <AppHeader title="Administration" />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6" data-testid="admin-page">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
            <TabsTrigger value="users" data-testid="admin-tab-users">
              Membres
            </TabsTrigger>
            <TabsTrigger value="reports" data-testid="admin-tab-reports">
              Signalements
            </TabsTrigger>
            <TabsTrigger value="photos" data-testid="admin-tab-photos">
              Photos
            </TabsTrigger>
            <TabsTrigger value="verifications" data-testid="admin-tab-verifications">
              Vérifications
            </TabsTrigger>
            <TabsTrigger value="payments" data-testid="admin-tab-payments">
              Paiements
            </TabsTrigger>
            <TabsTrigger value="support" data-testid="admin-tab-support">
              Support
            </TabsTrigger>
            <TabsTrigger value="demo" data-testid="admin-tab-demo">
              Profils de démo
            </TabsTrigger>
            <TabsTrigger value="ads" data-testid="admin-tab-ads">
              Publicités
            </TabsTrigger>
            <TabsTrigger value="logs" data-testid="admin-tab-logs">
              Journaux
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard">
            <StatsTab />
          </TabsContent>
          <TabsContent value="users">
            {selectedUser ? (
              <UserDetail userId={selectedUser} onBack={() => setSelectedUser(null)} />
            ) : (
              <MembersTable onSelect={setSelectedUser} />
            )}
          </TabsContent>
          <TabsContent value="reports">
            <Reports
              onOpenUser={(id) => {
                setSelectedUser(id);
                setTab("users");
              }}
            />
          </TabsContent>
          <TabsContent value="photos">
            <Photos />
          </TabsContent>
          <TabsContent value="verifications">
            <Verifications />
          </TabsContent>
          <TabsContent value="payments">
            <Payments />
          </TabsContent>
          <TabsContent value="support">
            <Support />
          </TabsContent>
          <TabsContent value="demo">
            <DemoProfilesTab />
          </TabsContent>
          <TabsContent value="ads">
            <AdsTab />
          </TabsContent>
          <TabsContent value="logs">
            <LogsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Loading() {
  return <Skeleton className="h-40 w-full rounded-2xl" />;
}

function Failed({ error }: { error: Error }) {
  return <p className="text-sm text-destructive">{error.message}</p>;
}

/** 23.6 à 23.9 — Fiche d'un membre et actions de modération. */
function UserDetail({ userId, onBack }: { userId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const setStatus = useServerFn(adminSetUserStatus);
  const [reason, setReason] = useState("");
  const { data, isLoading, error } = useQuery(adminUserDetailQuery(userId));
  const action = useMutation({
    mutationFn: (a: "suspend" | "reactivate" | "ban") =>
      setStatus({ data: { userId, action: a, ...(reason.trim() ? { reason } : {}) } }),
    onSuccess: async () => {
      setReason("");
      toast.success("Décision enregistrée.");
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });

  if (isLoading) return <Loading />;
  if (error) return <Failed error={error} />;
  if (!data) return null;
  const status = data.user.status;
  return (
    <div className="space-y-4" data-testid="admin-user-detail">
      <Button type="button" variant="ghost" size="sm" onClick={onBack}>
        ← Retour à la liste
      </Button>
      <section className="panel space-y-1 p-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          {data.profile?.first_name ?? "Sans prénom"}
        </h2>
        <p className="text-sm text-muted-foreground">{data.user.email}</p>
        <p className="text-xs text-muted-foreground">
          Statut : <strong data-testid="admin-user-status">{STATUS_LABEL[status] ?? status}</strong>
          {" · "}Inscrit le {fmt(data.user.created_at)} · Vu le {fmt(data.last_seen_at)}
          {data.premium ? " · Premium" : ""}
          {data.is_admin ? " · Administrateur" : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {data.counts["matches"] ?? 0} Matchs · {data.counts["messages"] ?? 0} messages ·{" "}
          {data.counts["reports_received"] ?? 0} signalements reçus ·{" "}
          {data.counts["blocked_by"] ?? 0} blocages reçus
        </p>
      </section>

      {!data.is_admin ? (
        <section className="panel space-y-3 p-4">
          <p className="eyebrow">Modération</p>
          <Textarea
            placeholder="Raison (obligatoire pour suspendre ou bannir)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            data-testid="admin-reason"
          />
          {action.isError ? <Failed error={action.error} /> : null}
          <div className="flex flex-wrap gap-2">
            {status !== "suspended" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={action.isPending}
                onClick={() => action.mutate("suspend")}
                data-testid="admin-suspend"
              >
                Suspendre
              </Button>
            ) : null}
            {status !== "active" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={action.isPending}
                onClick={() => action.mutate("reactivate")}
                data-testid="admin-reactivate"
              >
                Réactiver
              </Button>
            ) : null}
            {status !== "disabled" ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={action.isPending}
                onClick={() => action.mutate("ban")}
                data-testid="admin-ban"
              >
                Bannir
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="panel space-y-2 p-4">
        <p className="eyebrow">Historique de modération</p>
        {data.moderation.length ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {data.moderation.map((m, i) => (
              <li key={i}>
                {fmt(m.created_at)} · {m.action} · {m.reason ?? "sans raison"} ·{" "}
                {m.admin_email ?? "?"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Aucune action.</p>
        )}
      </section>

      <section className="panel space-y-2 p-4">
        <p className="eyebrow">Paiements</p>
        {data.payments.length ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {data.payments.map((p) => (
              <li key={p.id}>
                {fmt(p.created_at)} · {p.type} · {formatMoney(p.amount, p.currency)} · {p.status}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Aucun paiement.</p>
        )}
      </section>

      <UserLocation userId={userId} />

      <UserHistory userId={userId} />

      {!data.is_admin ? <DeleteMemberSection userId={userId} onDeleted={onBack} /> : null}
    </div>
  );
}

/** 23.10 / 23.11 — Signalements à traiter. */
function Reports({ onOpenUser }: { onOpenUser: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("open");
  const { data, isLoading, error } = useQuery(adminReportsQuery(status));
  const resolve = useMutation({
    mutationFn: (v: { id: string; status: "resolved" | "dismissed" }) =>
      resolveReport(v.id, v.status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <select
        className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        aria-label="Filtrer les signalements"
      >
        <option value="open">Ouverts</option>
        <option value="resolved">Traités</option>
        <option value="dismissed">Rejetés</option>
        <option value="">Tous</option>
      </select>
      {isLoading ? <Loading /> : error ? <Failed error={error} /> : null}
      {data && !data.length ? (
        <p className="text-sm text-muted-foreground">Aucun signalement.</p>
      ) : null}
      <ul className="space-y-2">
        {data?.map((r) => (
          <li key={r.id} className="panel space-y-2 p-3" data-testid="admin-report">
            <p className="text-sm text-foreground">
              <strong>{reasonLabel(r.reason)}</strong> · {r.reported_name ?? "?"} signalé(e) par{" "}
              {r.reporter_name ?? "?"} · {fmt(r.created_at)}
            </p>
            {r.description ? (
              <p className="text-xs text-muted-foreground">« {r.description} »</p>
            ) : null}
            {r.message_content ? (
              <p className="panel-2 p-2 text-xs text-foreground">Message : {r.message_content}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onOpenUser(r.reported_user_id)}
              >
                Voir le membre
              </Button>
              {r.status === "open" || r.status === "reviewing" ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ id: r.id, status: "resolved" })}
                    data-testid="admin-report-resolve"
                  >
                    Marquer traité
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ id: r.id, status: "dismissed" })}
                  >
                    Rejeter
                  </Button>
                </>
              ) : (
                <Badge variant="subtle">{r.status === "resolved" ? "Traité" : "Rejeté"}</Badge>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Photos en attente de validation. */
function Photos() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery(adminPhotosQuery());
  const moderate = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => moderatePhoto(v.id, v.approve),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
    onError: (e) => toast.error(e.message),
  });
  if (isLoading) return <Loading />;
  if (error) return <Failed error={error} />;
  if (!data?.length)
    return <p className="text-sm text-muted-foreground">Aucune photo en attente.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {data.map((p) => (
        <li key={p.id} className="panel space-y-2 p-2" data-testid="admin-photo">
          {p.url ? (
            <img
              src={p.url}
              alt={`Photo de ${p.first_name ?? "membre"}`}
              className="aspect-square w-full rounded-lg object-cover"
            />
          ) : (
            <div className="aspect-square w-full rounded-lg bg-muted" />
          )}
          <p className="truncate text-xs text-muted-foreground">{p.first_name ?? "?"}</p>
          <div className="grid grid-cols-2 gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={moderate.isPending}
              onClick={() => moderate.mutate({ id: p.id, approve: true })}
            >
              Valider
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={moderate.isPending}
              onClick={() => moderate.mutate({ id: p.id, approve: false })}
            >
              Refuser
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Vérification des profils : selfie ou pièce d'identité (photos privées). */
function Verifications() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery(adminVerificationsQuery());
  const review = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => reviewVerification(v.id, v.approve),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
    onError: (e) => toast.error(e.message),
  });
  if (isLoading) return <Loading />;
  if (error) return <Failed error={error} />;
  if (!data?.length)
    return <p className="text-sm text-muted-foreground">Aucune vérification en attente.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {data.map((v) => (
        <li key={v.id} className="panel space-y-2 p-2" data-testid="admin-verification">
          {v.url ? (
            <a href={v.url} target="_blank" rel="noreferrer">
              <img
                src={v.url}
                alt={`Vérification de ${v.first_name ?? "membre"}`}
                className="aspect-[3/4] w-full rounded-lg object-cover"
              />
            </a>
          ) : (
            <div className="aspect-[3/4] w-full rounded-lg bg-muted" />
          )}
          <p className="truncate text-xs text-muted-foreground">
            {v.first_name ?? "?"} · {v.method === "selfie" ? "Selfie" : "Pièce d'identité"}
          </p>
          <div className="grid grid-cols-2 gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={review.isPending}
              onClick={() => review.mutate({ id: v.id, approve: true })}
            >
              Valider
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={review.isPending}
              onClick={() => review.mutate({ id: v.id, approve: false })}
            >
              Refuser
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 23.12 à 23.14 — Paiements, abonnements Premium et déblocages. */
function Payments() {
  const payments = useQuery(adminPaymentsQuery());
  const subs = useQuery(adminSubscriptionsQuery());
  const unlocks = useQuery(adminUnlocksQuery());
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <p className="eyebrow">Paiements</p>
        {payments.isLoading ? (
          <Loading />
        ) : payments.error ? (
          <Failed error={payments.error} />
        ) : null}
        <ul className="space-y-1 text-xs" data-testid="admin-payments">
          {payments.data?.map((p) => (
            <li key={p.id} className="panel-2 p-2 text-muted-foreground">
              {fmt(p.created_at)} · {p.email ?? "?"} ·{" "}
              {p.type === "subscription" ? "Premium" : "Déblocage"} ·{" "}
              {formatMoney(p.amount, p.currency)} · {p.provider} · {p.status}
            </li>
          ))}
          {payments.data && !payments.data.length ? (
            <li className="text-muted-foreground">Aucun paiement.</li>
          ) : null}
        </ul>
      </section>
      <section className="space-y-2">
        <p className="eyebrow">Abonnements Premium</p>
        <ul className="space-y-1 text-xs">
          {subs.data?.map((s) => (
            <li key={s.id} className="panel-2 p-2 text-muted-foreground">
              {s.email ?? "?"} · {s.plan === "premium_yearly" ? "Annuel" : "Mensuel"} · du{" "}
              {fmt(s.starts_at)} au {fmt(s.expires_at)} · {s.active_now ? "actif" : s.status}
            </li>
          ))}
          {subs.data && !subs.data.length ? (
            <li className="text-muted-foreground">Aucun abonnement.</li>
          ) : null}
        </ul>
      </section>
      <section className="space-y-2">
        <p className="eyebrow">Déblocages de conversation</p>
        <ul className="space-y-1 text-xs">
          {unlocks.data?.map((u) => (
            <li key={u.id} className="panel-2 p-2 text-muted-foreground">
              {u.email ?? "?"} · du {fmt(u.starts_at)} au {fmt(u.expires_at)} ·{" "}
              {u.active_now ? "actif" : u.status}
            </li>
          ))}
          {unlocks.data && !unlocks.data.length ? (
            <li className="text-muted-foreground">Aucun déblocage.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

/** Tickets de support (Premium en priorité). */
function Support() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery(adminTicketsQuery());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const reply = useMutation({
    mutationFn: (v: { id: string; text: string }) => replyTicket(v.id, v.text, false),
    onSuccess: async (_d, v) => {
      setDrafts((d) => ({ ...d, [v.id]: "" }));
      toast.success("Réponse envoyée.");
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error(e.message),
  });
  if (isLoading) return <Loading />;
  if (error) return <Failed error={error} />;
  if (!data?.length) return <p className="text-sm text-muted-foreground">Aucun ticket.</p>;
  return (
    <ul className="space-y-3">
      {data.map((t) => (
        <li key={t.id} className="panel space-y-2 p-3" data-testid="admin-ticket">
          <p className="text-sm text-foreground">
            <strong>{t.subject}</strong>
            {t.priority === "priority" ? (
              <Badge variant="gold" className="ml-2">
                Prioritaire
              </Badge>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">
            {t.first_name ?? "?"} · {t.email} · {fmt(t.created_at)} · {t.status}
          </p>
          <p className="whitespace-pre-line text-sm text-foreground">{t.message}</p>
          {t.admin_reply ? (
            <p className="panel-2 p-2 text-xs text-foreground">Réponse : {t.admin_reply}</p>
          ) : null}
          {t.status === "open" ? (
            <div className="space-y-2">
              <Textarea
                rows={2}
                placeholder="Votre réponse"
                value={drafts[t.id] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
              />
              <Button
                type="button"
                size="sm"
                disabled={!drafts[t.id]?.trim() || reply.isPending}
                onClick={() => reply.mutate({ id: t.id, text: drafts[t.id] ?? "" })}
              >
                Répondre
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
