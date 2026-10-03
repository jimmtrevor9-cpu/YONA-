import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SponsoredBanner } from "@/components/ads/SponsoredBanner";
import { SponsoredCard } from "@/components/ads/SponsoredCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminRunStorageCleanup } from "@/features/admin/admin.functions";
import {
  AD_CTA_ICONS,
  AD_PLACEMENTS,
  MEDIA_RULES,
  adPreview,
  extractVideoPoster,
  mediaError,
  mediaKind,
  saveAd,
  uploadAdFile,
  type AdRow,
  type AdStatus,
} from "@/features/ads/admin-ads";
import { ADS_BUCKET, safeAdUrl, type AdCtaIcon, type SponsoredAd } from "@/features/ads/ads";
import { loadCountries } from "@/features/profiles/geo";
import { supabase } from "@/integrations/supabase/client";

const pad = (n: number) => String(n).padStart(2, "0");
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const intOrNull = (v: string) => (v.trim() === "" ? null : Number.parseInt(v, 10));

interface Form {
  title: string;
  body: string;
  advertiser: string;
  ctaLabel: string;
  ctaUrl: string;
  ctaIcon: AdCtaIcon;
  placements: string[];
  status: AdStatus;
  startsAt: string;
  endsAt: string;
  countries: string[];
  gender: "" | "female" | "male";
  minAge: string;
  maxAge: string;
  priority: string;
  dailyCap: string;
}

function initialForm(ad: AdRow | null): Form {
  return {
    title: ad?.title ?? "",
    body: ad?.body ?? "",
    advertiser: ad?.advertiser ?? "",
    ctaLabel: ad?.cta_label ?? "En savoir plus",
    ctaUrl: ad?.cta_url ?? "https://",
    ctaIcon: (ad?.cta_icon as AdCtaIcon) ?? "external",
    placements: ad?.placements ?? ["discover"],
    status: (ad?.status as AdStatus) ?? "draft",
    startsAt: toLocalInput(ad?.starts_at ?? new Date().toISOString()),
    endsAt: toLocalInput(ad?.ends_at),
    countries: ad?.target_countries ?? [],
    gender: (ad?.target_gender as Form["gender"]) ?? "",
    minAge: ad?.min_age?.toString() ?? "",
    maxAge: ad?.max_age?.toString() ?? "",
    priority: String(ad?.priority ?? 0),
    dailyCap: String(ad?.daily_cap ?? 3),
  };
}

const field = "space-y-1 text-xs text-muted-foreground";
const select =
  "h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground";

/** Création ou modification d'une publicité, avec aperçu avant publication. */
export function AdEditor({ ad, onDone }: { ad: AdRow | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const cleanup = useServerFn(adminRunStorageCleanup);
  const [form, setForm] = useState<Form>(() => initialForm(ad));
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState("");
  const { data: countries = [] } = useQuery({
    queryKey: ["geo", "countries"],
    queryFn: loadCountries,
    staleTime: Infinity,
  });
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Aperçus locaux des fichiers choisis (libérés au changement).
  const mediaPreviewUrl = useMemo(
    () => (mediaFile ? URL.createObjectURL(mediaFile) : null),
    [mediaFile],
  );
  const posterPreviewUrl = useMemo(
    () => (posterFile ? URL.createObjectURL(posterFile) : null),
    [posterFile],
  );
  useEffect(
    () => () => void (mediaPreviewUrl && URL.revokeObjectURL(mediaPreviewUrl)),
    [mediaPreviewUrl],
  );
  useEffect(
    () => () => void (posterPreviewUrl && URL.revokeObjectURL(posterPreviewUrl)),
    [posterPreviewUrl],
  );

  const mediaType: "image" | "video" | null = mediaFile
    ? mediaKind(mediaFile)
    : ((ad?.media_type as "image" | "video") ?? null);
  const base = ad ? adPreview(ad) : null;
  const preview: SponsoredAd | null =
    mediaType && (mediaPreviewUrl || base)
      ? {
          id: ad?.id ?? "apercu",
          title: form.title || "Titre de la publicité",
          body: form.body || null,
          advertiser: form.advertiser || null,
          mediaType,
          mediaUrl: mediaPreviewUrl ?? base!.mediaUrl,
          posterUrl: posterPreviewUrl ?? (mediaFile ? null : (base?.posterUrl ?? null)),
          ctaLabel: form.ctaLabel || "En savoir plus",
          ctaUrl: safeAdUrl(form.ctaUrl) ?? "https://exemple.com",
          ctaIcon: form.ctaIcon,
          everyN: 5,
        }
      : null;

  async function submit() {
    setError(null);
    if (!form.title.trim()) return setError("Le titre est obligatoire.");
    if (!safeAdUrl(form.ctaUrl) || !/^https:\/\/[^/\s]+\.[^/\s]+/.test(form.ctaUrl.trim()))
      return setError("Le lien doit être une adresse complète commençant par https://");
    if (!form.placements.length) return setError("Choisissez au moins un emplacement.");
    if (!ad && !mediaFile) return setError("Ajoutez une image ou une vidéo.");
    const min = intOrNull(form.minAge);
    const max = intOrNull(form.maxAge);
    if ((min !== null && (min < 18 || min > 99)) || (max !== null && (max < 18 || max > 99)))
      return setError("Les âges doivent être entre 18 et 99 ans.");

    setSaving(true);
    const id = ad?.id ?? crypto.randomUUID();
    const uploaded: string[] = [];
    try {
      let mediaPath = ad?.media_path ?? "";
      let posterPath = ad?.poster_path ?? null;
      let type = (ad?.media_type as "image" | "video") ?? "image";
      if (mediaFile) {
        type = mediaKind(mediaFile) ?? "image";
        mediaPath = await uploadAdFile(id, mediaFile, "media");
        uploaded.push(mediaPath);
        posterPath = null;
        if (type === "video" && !posterFile) {
          const frame = await extractVideoPoster(mediaFile);
          if (frame) {
            posterPath = await uploadAdFile(id, frame, "poster");
            uploaded.push(posterPath);
          }
        }
      }
      if (posterFile && type === "video") {
        posterPath = await uploadAdFile(id, posterFile, "poster");
        uploaded.push(posterPath);
      }
      if (type === "image") posterPath = null;
      await saveAd(
        {
          id,
          title: form.title.trim(),
          body: form.body.trim() || null,
          advertiser: form.advertiser.trim() || null,
          media_type: type,
          media_path: mediaPath,
          poster_path: posterPath,
          cta_label: form.ctaLabel.trim() || "En savoir plus",
          cta_url: form.ctaUrl.trim(),
          cta_icon: form.ctaIcon,
          placements: form.placements,
          status: form.status,
          starts_at: fromLocalInput(form.startsAt) ?? new Date().toISOString(),
          ends_at: fromLocalInput(form.endsAt),
          target_countries: form.countries,
          target_gender: form.gender || null,
          min_age: min,
          max_age: max,
          priority: Math.min(100, Math.max(0, intOrNull(form.priority) ?? 0)),
          daily_cap: Math.min(50, Math.max(1, intOrNull(form.dailyCap) ?? 3)),
        },
        !ad,
      );
      // Anciens fichiers remplacés : supprimés du stockage (file d'attente de la base).
      if (ad && mediaFile) void cleanup().catch(() => undefined);
      toast.success(ad ? "Publicité modifiée." : "Publicité créée.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "ads"] });
      onDone();
    } catch (e) {
      if (uploaded.length) void supabase.storage.from(ADS_BUCKET).remove(uploaded);
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="ad-editor">
      <Button type="button" variant="ghost" size="sm" onClick={onDone}>
        ← Retour aux publicités
      </Button>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form
          className="panel space-y-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h2 className="font-display text-xl font-semibold text-foreground">
            {ad ? "Modifier la publicité" : "Nouvelle publicité"}
          </h2>

          <section className="space-y-2">
            <p className="eyebrow">Image ou vidéo</p>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border p-3 text-sm text-foreground hover:bg-foreground/5">
              <ImagePlus className="size-5 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                {mediaFile ? mediaFile.name : ad ? "Remplacer le média" : "Choisir un fichier"}
              </span>
              <input
                type="file"
                accept={[...MEDIA_RULES.image.types, ...MEDIA_RULES.video.types].join(",")}
                className="sr-only"
                data-testid="ad-media-input"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  if (!file) return;
                  const problem = mediaError(file);
                  if (problem) return void toast.error(problem);
                  setMediaFile(file);
                }}
              />
            </label>
            <p className="text-[11px] text-muted-foreground">
              Image : {MEDIA_RULES.image.label} Vidéo : {MEDIA_RULES.video.label} Format conseillé :
              vertical 9:16 (1080 × 1920). Vidéo : lue sans son, l'image d'aperçu est créée
              automatiquement si vous n'en choisissez pas.
            </p>
            {mediaType === "video" ? (
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border p-3 text-sm text-foreground hover:bg-foreground/5">
                <ImagePlus className="size-5 text-primary" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {posterFile ? posterFile.name : "Image d'aperçu de la vidéo (facultatif)"}
                </span>
                <input
                  type="file"
                  accept={MEDIA_RULES.image.types.join(",")}
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    if (!file) return;
                    const problem = mediaError(file, "image");
                    if (problem) return void toast.error(problem);
                    setPosterFile(file);
                  }}
                />
              </label>
            ) : null}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <label className={`${field} sm:col-span-2`}>
              Titre (90 caractères max.)
              <Input
                value={form.title}
                maxLength={90}
                onChange={(e) => set("title", e.target.value)}
                data-testid="ad-title"
              />
            </label>
            <label className={`${field} sm:col-span-2`}>
              Texte (300 caractères max.)
              <Textarea
                rows={2}
                value={form.body}
                maxLength={300}
                onChange={(e) => set("body", e.target.value)}
              />
            </label>
            <label className={field}>
              Annonceur (facultatif)
              <Input
                value={form.advertiser}
                maxLength={40}
                onChange={(e) => set("advertiser", e.target.value)}
              />
            </label>
            <label className={field}>
              Texte du bouton
              <Input
                value={form.ctaLabel}
                maxLength={24}
                onChange={(e) => set("ctaLabel", e.target.value)}
              />
            </label>
            <label className={field}>
              Lien de destination (https://…)
              <Input
                type="url"
                inputMode="url"
                value={form.ctaUrl}
                maxLength={500}
                onChange={(e) => set("ctaUrl", e.target.value)}
                data-testid="ad-url"
              />
            </label>
            <label className={field}>
              Icône du bouton
              <select
                className={select}
                value={form.ctaIcon}
                onChange={(e) => set("ctaIcon", e.target.value as AdCtaIcon)}
              >
                {AD_CTA_ICONS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <fieldset className="space-y-2">
            <legend className="eyebrow">Emplacements</legend>
            {AD_PLACEMENTS.map((p) => (
              <label key={p.value} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={form.placements.includes(p.value)}
                  onChange={(e) =>
                    set(
                      "placements",
                      e.target.checked
                        ? [...form.placements, p.value]
                        : form.placements.filter((x) => x !== p.value),
                    )
                  }
                />
                {p.label}
              </label>
            ))}
          </fieldset>

          <section className="grid gap-3 sm:grid-cols-2">
            <label className={field}>
              Début
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
              />
            </label>
            <label className={field}>
              Fin (facultatif)
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => set("endsAt", e.target.value)}
              />
            </label>
          </section>

          <section className="space-y-3">
            <p className="eyebrow">Ciblage (facultatif)</p>
            <div className="space-y-2">
              <label className={field}>
                Pays (aucun = tous les pays)
                <div className="flex gap-2">
                  <Input
                    list="ad-countries"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Gabon, Cameroun…"
                    data-testid="ad-country"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !countries.some((c) => c.name === country) || form.countries.includes(country)
                    }
                    onClick={() => {
                      set("countries", [...form.countries, country]);
                      setCountry("");
                    }}
                  >
                    Ajouter
                  </Button>
                </div>
                <datalist id="ad-countries">
                  {countries.map((c) => (
                    <option key={c.code} value={c.name} />
                  ))}
                </datalist>
              </label>
              {form.countries.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {form.countries.map((c) => (
                    <li key={c}>
                      <button
                        type="button"
                        onClick={() =>
                          set(
                            "countries",
                            form.countries.filter((x) => x !== c),
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-foreground hover:bg-primary/20"
                        aria-label={`Retirer ${c}`}
                      >
                        {c} <X className="size-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className={field}>
                Sexe
                <select
                  className={select}
                  value={form.gender}
                  onChange={(e) => set("gender", e.target.value as Form["gender"])}
                >
                  <option value="">Tous</option>
                  <option value="female">Femmes</option>
                  <option value="male">Hommes</option>
                </select>
              </label>
              <label className={field}>
                Âge min.
                <Input
                  type="number"
                  min={18}
                  max={99}
                  value={form.minAge}
                  onChange={(e) => set("minAge", e.target.value)}
                />
              </label>
              <label className={field}>
                Âge max.
                <Input
                  type="number"
                  min={18}
                  max={99}
                  value={form.maxAge}
                  onChange={(e) => set("maxAge", e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <label className={field}>
              Priorité (0 à 100)
              <Input
                type="number"
                min={0}
                max={100}
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
              />
            </label>
            <label className={field}>
              Vues max. par membre et par jour
              <Input
                type="number"
                min={1}
                max={50}
                value={form.dailyCap}
                onChange={(e) => set("dailyCap", e.target.value)}
              />
            </label>
            <label className={field}>
              État
              <select
                className={select}
                value={form.status}
                onChange={(e) => set("status", e.target.value as AdStatus)}
                data-testid="ad-status"
              >
                <option value="draft">Brouillon (invisible)</option>
                <option value="active">Publiée</option>
                <option value="paused">En pause</option>
              </select>
            </label>
          </section>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving} data-testid="ad-save">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone} disabled={saving}>
              Annuler
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Seuls les membres gratuits voient les publicités : jamais les membres Premium ni les
            administrateurs. Aucun traceur extérieur : vues et clics sont comptés par YONA.
          </p>
        </form>

        <aside className="space-y-3" aria-label="Aperçu">
          <p className="eyebrow">Aperçu avant publication</p>
          {preview ? (
            <>
              <div className="mx-auto aspect-[9/16] w-full max-w-[340px]" data-testid="ad-preview">
                <SponsoredCard ad={preview} preview onSkip={() => undefined} />
              </div>
              {form.placements.some((p) => p !== "discover") ? (
                <SponsoredBanner
                  ad={preview}
                  placement="matches"
                  preview
                  onHide={() => undefined}
                />
              ) : null}
            </>
          ) : (
            <p className="panel p-6 text-center text-sm text-muted-foreground">
              Choisissez une image ou une vidéo pour voir l'aperçu.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
