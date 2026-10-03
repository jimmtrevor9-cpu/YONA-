import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";

import { cellText } from "@/components/admin/table-utils";
import { Badge } from "@/components/ui/badge";
import { adminUserLocationQuery } from "@/features/location/admin-location";
import { SOURCE_LABEL, countryLabel, reasonLabel } from "@/features/location/labels";

/**
 * Tâche E — Localisation d'un membre : position retenue (appareil > ville déclarée > IP),
 * indices (pays de l'IP, fuseau horaire, langue) et incohérence éventuelle (VPN possible).
 */
export function UserLocation({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery(adminUserLocationQuery(userId));
  if (isLoading) return null;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  const c = data?.current ?? null;
  return (
    <section className="panel space-y-3 p-4" data-testid="admin-user-location">
      <p className="eyebrow">Localisation</p>
      {c ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
            <strong>
              {[c.city, c.region, c.country].filter(Boolean).join(", ") || "Ville inconnue"}
            </strong>
            <Badge variant="subtle">{SOURCE_LABEL[c.source] ?? c.source}</Badge>
            {c.accuracy_m ? (
              <span className="text-xs text-muted-foreground">± {c.accuracy_m} m</span>
            ) : null}
          </div>
          {c.inconsistent ? (
            <p
              className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 p-2 text-xs text-foreground"
              data-testid="admin-location-flag"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
              <span>
                <strong>Incohérence de localisation (VPN possible) :</strong>{" "}
                {c.inconsistency.map(reasonLabel).join(" · ")}. Aucun blocage automatique.
              </span>
            </p>
          ) : null}
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-2 border-b border-border py-1">
              <dt className="text-muted-foreground">Ville du profil</dt>
              <dd className="text-right text-foreground">
                {[data?.declared?.city, data?.declared?.country].filter(Boolean).join(", ") || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-border py-1">
              <dt className="text-muted-foreground">Adresse IP (dernière visite)</dt>
              <dd className="text-right text-foreground">
                {c.ip_country
                  ? `${c.ip_city ? `${c.ip_city}, ` : ""}${countryLabel(c.ip_country)}`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-border py-1">
              <dt className="text-muted-foreground">Fuseau horaire</dt>
              <dd className="text-right text-foreground">{c.timezone ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-border py-1">
              <dt className="text-muted-foreground">Langue du navigateur</dt>
              <dd className="text-right text-foreground">{c.language ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-border py-1">
              <dt className="text-muted-foreground">Position enregistrée le</dt>
              <dd className="text-right text-foreground">{cellText(c.updated_at)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-border py-1">
              <dt className="text-muted-foreground">Dernière vérification</dt>
              <dd className="text-right text-foreground">{cellText(c.checked_at)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Aucune position retenue : le pays du profil ({data?.declared?.country ?? "non précisé"})
          sert de référence.
        </p>
      )}
      {data?.history.length ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Positions reçues ({data.history.length})
          </summary>
          <ul className="mt-2 max-h-48 space-y-0.5 overflow-auto text-muted-foreground">
            {data.history.map((h) => (
              <li key={h.id}>
                {cellText(h.created_at)} · reçue : {SOURCE_LABEL[h.source] ?? h.source} · retenue :{" "}
                {SOURCE_LABEL[h.retained_source] ?? h.retained_source} ·{" "}
                {[h.city, h.country].filter(Boolean).join(", ") || "—"}
                {h.ip_country ? ` · IP ${countryLabel(h.ip_country)}` : ""}
                {h.inconsistent ? ` · ${h.inconsistency.map(reasonLabel).join(" · ")}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        Un VPN change l'adresse IP, pas la position de l'appareil : seule la position de l'appareil,
        quand le membre l'autorise, est fiable. L'adresse IP n'est utilisée qu'en dernier recours.
      </p>
    </section>
  );
}
