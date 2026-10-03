import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { cellText } from "@/components/admin/table-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { adminDeleteUser } from "@/features/admin/admin.functions";
import {
  EVENT_LABELS,
  adminUserHistoryQuery,
  productLabel,
  verificationUrl,
} from "@/features/admin/dashboard";
import { formatMoney } from "@/features/admin/queries";

const label = (event: string) => EVENT_LABELS[event] ?? event;

/** Tâche D2 — Historique complet d'un membre dans sa fiche. */
export function UserHistory({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery(adminUserHistoryQuery(userId));
  const [opening, setOpening] = useState<string | null>(null);
  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!data) return null;

  async function openVerification(path: string) {
    setOpening(path);
    const url = await verificationUrl(path);
    setOpening(null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else toast.error("Photo introuvable : elle a peut-être déjà été supprimée après la décision.");
  }

  return (
    <div className="space-y-4" data-testid="admin-user-history">
      <section className="panel space-y-2 p-4">
        <p className="eyebrow">Connexions (100 dernières)</p>
        {data.connections.length ? (
          <div className="max-h-72 overflow-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 font-medium">Date</th>
                  <th className="py-1 pr-2 font-medium">Événement</th>
                  <th className="py-1 pr-2 font-medium">IP</th>
                  <th className="py-1 pr-2 font-medium">Lieu</th>
                  <th className="py-1 font-medium">Appareil</th>
                </tr>
              </thead>
              <tbody>
                {data.connections.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="whitespace-nowrap py-1 pr-2">{cellText(c.created_at)}</td>
                    <td className="py-1 pr-2">{label(c.event)}</td>
                    <td className="py-1 pr-2">{c.ip ?? "—"}</td>
                    <td className="py-1 pr-2">
                      {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="max-w-[220px] truncate py-1" title={c.user_agent ?? ""}>
                      {c.user_agent ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Aucune connexion enregistrée.</p>
        )}
      </section>

      <section className="panel space-y-2 p-4">
        <p className="eyebrow">Inscription</p>
        {data.signup.length ? (
          <ol className="flex flex-wrap gap-1.5">
            {data.signup.map((s) => (
              <li key={s.step}>
                <Badge variant="subtle" title={cellText(s.at)}>
                  {label(s.step)}
                </Badge>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground">Aucune étape enregistrée.</p>
        )}
      </section>

      <section className="panel space-y-2 p-4">
        <p className="eyebrow">Actions</p>
        {Object.keys(data.activity_counts).length ? (
          <ul className="flex flex-wrap gap-1.5">
            {Object.entries(data.activity_counts).map(([event, n]) => (
              <li key={event}>
                <Badge variant="subtle">
                  {label(event)} : {n}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Aucune action.</p>
        )}
        {data.activity.length ? (
          <ul className="max-h-48 space-y-0.5 overflow-auto text-xs text-muted-foreground">
            {data.activity.map((a) => (
              <li key={a.id}>
                {cellText(a.created_at)} · {label(a.event)}
                {a.country ? ` · ${a.country}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="panel space-y-2 p-4">
        <p className="eyebrow">Paiements (journal)</p>
        {data.payments.length ? (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {data.payments.map((p) => (
              <li key={p.id}>
                {cellText(p.created_at)} · {label(p.event)}
                {p.product ? ` · ${productLabel(p.product)}` : ""}
                {typeof p.amount === "number"
                  ? ` · ${formatMoney(p.amount, p.currency ?? "EUR")}`
                  : ""}
                {p.reason ? ` · ${p.reason}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Aucun paiement.</p>
        )}
      </section>

      <section className="panel space-y-2 p-4">
        <p className="eyebrow">Vérifications d'identité</p>
        {data.verifications.length ? (
          <ul className="space-y-1 text-xs">
            {data.verifications.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2 text-muted-foreground">
                {cellText(v.created_at)} · {v.method === "selfie" ? "Selfie" : "Pièce d'identité"} ·{" "}
                {v.status === "approved"
                  ? "acceptée"
                  : v.status === "rejected"
                    ? "refusée"
                    : "en attente"}
                {v.storage_path && v.status === "pending" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={opening === v.storage_path}
                    onClick={() => void openVerification(v.storage_path!)}
                    data-testid="admin-open-verification"
                  >
                    Voir la photo
                  </Button>
                ) : (
                  <span>
                    {v.status === "pending"
                      ? "(pas de photo)"
                      : "(photo supprimée après la décision)"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Aucune demande.</p>
        )}
      </section>

      <section className="panel space-y-2 p-4">
        <p className="eyebrow">Audit (modifications faites par l'administration)</p>
        {data.audit.length ? (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {data.audit.map((a, i) => (
              <li key={i} className="break-words">
                {cellText(a.at)} · {label(a.action)} · {a.table} · {a.admin ?? "?"}
                {a.changes && Object.keys(a.changes).length
                  ? ` · ${JSON.stringify(a.changes)}`
                  : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Aucune modification.</p>
        )}
      </section>
    </div>
  );
}

/** Suppression définitive d'un compte (raison obligatoire, confirmation écrite). */
export function DeleteMemberSection({
  userId,
  onDeleted,
}: {
  userId: string;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const remove = useServerFn(adminDeleteUser);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const mutation = useMutation({
    mutationFn: () => remove({ data: { userId, reason, confirmation } }),
    onSuccess: () => {
      toast.success("Compte supprimé.");
      // Retour à la liste d'abord : la fiche de ce compte n'existe plus.
      onDeleted();
      queryClient.removeQueries({ queryKey: ["admin", "user", userId] });
      queryClient.removeQueries({ queryKey: ["admin", "history", userId] });
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  return (
    <section
      className="panel space-y-3 border-destructive/30 p-4"
      data-testid="admin-delete-section"
    >
      <p className="eyebrow text-destructive">Supprimer le compte</p>
      <p className="text-xs text-muted-foreground">
        Définitif : profil, photos, messages et paiements de ce membre sont effacés. La décision et
        sa raison restent dans le journal d'audit.
      </p>
      <Textarea
        rows={2}
        placeholder="Raison (obligatoire)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        data-testid="admin-delete-reason"
      />
      <Input
        placeholder="Écrivez SUPPRIMER"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        aria-label="Confirmation"
        data-testid="admin-delete-confirmation"
      />
      {mutation.isError ? (
        <p className="text-sm text-destructive">{mutation.error.message}</p>
      ) : null}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={
          mutation.isPending ||
          reason.trim().length < 3 ||
          confirmation.trim().toUpperCase() !== "SUPPRIMER"
        }
        onClick={() => mutation.mutate()}
        data-testid="admin-delete"
      >
        Supprimer définitivement
      </Button>
    </section>
  );
}
