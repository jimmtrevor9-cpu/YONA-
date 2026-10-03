import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { cellText } from "@/components/admin/table-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { adminRunStorageCleanup } from "@/features/admin/admin.functions";
import {
  DOC_LABELS,
  REASON_LABELS,
  reviewQueued,
  saveVerificationSettings,
  verificationQueueQuery,
  verificationSettingsQuery,
  type VerificationSettings,
} from "@/features/verification/admin";
import { verificationEngineInfo } from "@/features/verification/verification.functions";

const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)} %`);

/**
 * Tâche F — Vérifications : la décision est automatique. Ici, seulement les cas incertains
 * (zone grise, moteur indisponible), avec les scores et les images privées (liens de
 * 10 minutes), et les réglages de la vérification automatique.
 */
export function VerificationsTab() {
  const queryClient = useQueryClient();
  const cleanup = useServerFn(adminRunStorageCleanup);
  const queue = useQuery(verificationQueueQuery());
  const review = useMutation({
    mutationFn: async (v: { id: string; approve: boolean }) => {
      await reviewQueued(v.id, v.approve);
      await cleanup().catch(() => undefined);
    },
    onSuccess: async (_d, v) => {
      toast.success(v.approve ? "Identité validée." : "Vérification refusée.");
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-5" data-testid="admin-verifications">
      <section className="space-y-2">
        <h2 className="font-display text-xl font-semibold text-foreground">Cas à examiner</h2>
        <p className="text-xs text-muted-foreground">
          La vérification est automatique. N'apparaissent ici que les cas incertains : ressemblance
          entre les deux seuils, ou moteur momentanément indisponible. Les images sont supprimées
          dès votre décision.
        </p>
        {queue.isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : queue.error ? (
          <p className="text-sm text-destructive">{queue.error.message}</p>
        ) : !queue.data?.length ? (
          <p className="panel p-6 text-center text-sm text-muted-foreground">
            Aucun cas à examiner.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {queue.data.map((v) => (
              <li key={v.id} className="panel space-y-3 p-3" data-testid="admin-verification">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-foreground">{v.first_name ?? "Membre"}</strong>
                  <Badge variant="gold">{REASON_LABELS[v.reason ?? ""] ?? v.reason ?? "—"}</Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {cellText(v.created_at)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["Selfie", v.selfieUrl],
                      [
                        v.challenge === "turn_left" ? "Tête à gauche" : "Tête à droite",
                        v.challengeUrl,
                      ],
                      [
                        v.document_type ? (DOC_LABELS[v.document_type] ?? "Pièce") : "Pièce",
                        v.documentUrl,
                      ],
                    ] as const
                  ).map(([label, url]) =>
                    url ? (
                      <a
                        key={label}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="space-y-1"
                      >
                        <img
                          src={url}
                          alt={label}
                          className="aspect-[3/4] w-full rounded-lg object-cover"
                        />
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {label}
                        </span>
                      </a>
                    ) : null,
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                  <dt className="text-muted-foreground">Ressemblance profil</dt>
                  <dd className="text-right font-semibold tabular-nums">
                    {pct(v.profile_similarity)}
                  </dd>
                  <dt className="text-muted-foreground">Ressemblance pièce</dt>
                  <dd className="text-right font-semibold tabular-nums">
                    {pct(v.document_similarity)}
                  </dd>
                  <dt className="text-muted-foreground">Selfie ↔ 2e image</dt>
                  <dd className="text-right font-semibold tabular-nums">
                    {pct(v.liveness_similarity)}
                  </dd>
                  <dt className="text-muted-foreground">Moteur</dt>
                  <dd className="text-right">{v.engine ?? "—"}</dd>
                </dl>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: v.id, approve: true })}
                    data-testid="admin-verification-approve"
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
        )}
      </section>
      <SettingsForm />
    </div>
  );
}

const FIELDS: {
  key: keyof Omit<VerificationSettings, "id" | "updated_at">;
  label: string;
  step: string;
  hint: string;
}[] = [
  {
    key: "accept_similarity",
    label: "Seuil d'acceptation",
    step: "0.01",
    hint: "Ressemblance de 0 à 1 (moteur local). Au-dessus : vérifié.",
  },
  {
    key: "reject_similarity",
    label: "Seuil de refus",
    step: "0.01",
    hint: "En dessous : refusé. Entre les deux : à examiner.",
  },
  {
    key: "liveness_min_shift",
    label: "Rotation minimale de la tête",
    step: "0.01",
    hint: "Consigne « tourne la tête » (0,08 conseillé).",
  },
  {
    key: "min_sharpness",
    label: "Netteté minimale",
    step: "1",
    hint: "En dessous : « image floue ».",
  },
  {
    key: "max_attempts_per_day",
    label: "Essais par jour",
    step: "1",
    hint: "Par membre, sur 24 heures.",
  },
  {
    key: "file_retention_hours",
    label: "Conservation des images (heures)",
    step: "1",
    hint: "0 = supprimées dès la décision.",
  },
  {
    key: "aws_accept_similarity",
    label: "AWS : seuil d'acceptation",
    step: "0.01",
    hint: "Si le service AWS Rekognition est activé.",
  },
  {
    key: "aws_reject_similarity",
    label: "AWS : seuil de refus",
    step: "0.01",
    hint: "Si le service AWS Rekognition est activé.",
  },
];

function SettingsForm() {
  const queryClient = useQueryClient();
  const settings = useQuery(verificationSettingsQuery());
  const engineInfo = useServerFn(verificationEngineInfo);
  const engine = useQuery({
    queryKey: ["admin", "verification-engine"],
    queryFn: () => engineInfo(),
  });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () =>
      saveVerificationSettings(
        Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v)])) as never,
      ),
    onSuccess: async () => {
      setDraft({});
      toast.success("Réglages enregistrés.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "verification-settings"] });
    },
    onError: (e) => toast.error(e.message),
  });
  if (!settings.data) return null;
  const s = settings.data;
  return (
    <section className="panel space-y-4 p-4" data-testid="admin-verification-settings">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">Réglages</h2>
        <p className="text-xs text-muted-foreground">
          Moteur utilisé :{" "}
          <strong className="text-foreground">
            {engine.data?.provider === "aws"
              ? `AWS Rekognition${engine.data.awsConfigured ? "" : " (clés manquantes : les vérifications restent en attente)"}`
              : "local, open source (@vladmandic/face-api), gratuit"}
          </strong>
          . Variable d'environnement FACE_MATCH_PROVIDER (local ou aws).
        </p>
      </div>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {FIELDS.map((f) => (
          <label key={f.key} className="space-y-1 text-xs text-muted-foreground">
            <span className="text-foreground">{f.label}</span>
            <Input
              type="number"
              step={f.step}
              min={0}
              value={draft[f.key] ?? String(s[f.key])}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            />
            <span>{f.hint}</span>
          </label>
        ))}
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={!Object.keys(draft).length || save.isPending}>
            Enregistrer les réglages
          </Button>
        </div>
      </form>
    </section>
  );
}
