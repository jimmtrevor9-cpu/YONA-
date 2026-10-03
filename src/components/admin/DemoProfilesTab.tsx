import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { adminRunStorageCleanup } from "@/features/admin/admin.functions";
import {
  adminDemoProfilesQuery,
  clearDemoPhoto,
  DEMO_PHOTO_SOURCES,
  setDemoPhoto,
  type DemoPhotoSource,
} from "@/features/admin/demo-profiles";
import { validatePhotoFile } from "@/features/profiles/photos";
import { computeAge } from "@/features/profiles/queries";

type DemoProfile = NonNullable<
  Awaited<ReturnType<NonNullable<ReturnType<typeof adminDemoProfilesQuery>["queryFn"]>>>
>[number];

/**
 * Profils de démonstration : visibles par les membres seulement avec une photo autorisée,
 * toujours signalés par l'étiquette « Profil de démonstration ». Chaque vraie identité
 * vérifiée en retire un automatiquement.
 */
export function DemoProfilesTab() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery(adminDemoProfilesQuery());
  const cleanup = useServerFn(adminRunStorageCleanup);
  const [editing, setEditing] = useState<DemoProfile | null>(null);

  // Fichiers de profils retirés : supprimés à l'ouverture de l'onglet.
  useEffect(() => {
    void cleanup().catch(() => undefined);
  }, [cleanup]);

  const clear = useMutation({
    mutationFn: (userId: string) => clearDemoPhoto(userId),
    onSuccess: () => {
      toast.success("Photo retirée : ce profil n'est plus montré aux membres.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "demo-profiles"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  const list = data ?? [];
  const visible = list.filter((p) => p.demo_photo_path).length;
  const women = list.filter((p) => p.gender === "female").length;

  return (
    <div className="space-y-4" data-testid="admin-demo-profiles">
      <div className="panel space-y-2 p-4 text-sm">
        <p className="font-medium text-foreground">
          {list.length} profils de démonstration ({women} femmes, {list.length - women} hommes) ·{" "}
          <span data-testid="demo-visible-count">{visible}</span> visibles
        </p>
        <p className="text-muted-foreground">
          Un profil n'est montré aux membres qu'avec une photo, et toujours avec l'étiquette «
          Profil de démonstration ». Chaque nouveau membre dont l'identité est vérifiée en retire un
          automatiquement.
        </p>
        <p className="flex gap-2 text-xs text-destructive">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          N'utilisez jamais la photo d'une personne réelle trouvée sur internet ou sur un autre
          site, ni une image retouchée à partir d'elle : c'est interdit (droit à l'image).
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {list.map((p) => (
          <li key={p.user_id} className="panel space-y-2 p-2" data-testid="admin-demo-profile">
            {p.url ? (
              <img
                src={p.url}
                alt={`Photo du profil de démonstration ${p.first_name ?? ""}`}
                className="aspect-[3/4] w-full rounded-lg object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg bg-muted font-display text-3xl text-muted-foreground">
                {(p.first_name ?? "?").charAt(0)}
              </div>
            )}
            <p className="truncate text-xs text-foreground">
              {p.first_name} · {computeAge(p.birth_date) ?? "?"} ans ·{" "}
              {p.gender === "female" ? "F" : "H"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {[p.city, p.country].filter(Boolean).join(", ")}
            </p>
            <div className="grid gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(p)}>
                <ImagePlus aria-hidden />
                {p.url ? "Changer" : "Ajouter une photo"}
              </Button>
              {p.url ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={clear.isPending}
                  onClick={() => clear.mutate(p.user_id)}
                >
                  <Trash2 aria-hidden />
                  Retirer
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <DemoPhotoDialog profile={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function DemoPhotoDialog({
  profile,
  onClose,
}: {
  profile: DemoProfile | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<DemoPhotoSource | null>(null);
  const [attested, setAttested] = useState(false);

  useEffect(() => {
    setFile(null);
    setSource(null);
    setAttested(false);
  }, [profile?.user_id]);

  const save = useMutation({
    mutationFn: () => setDemoPhoto(profile!.user_id, file!, source!),
    onSuccess: () => {
      toast.success("Photo publiée : le profil de démonstration est visible.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "demo-profiles"] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={!!profile} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Photo de {profile?.first_name}</DialogTitle>
          <DialogDescription>
            Profil de démonstration ({profile?.gender === "female" ? "femme" : "homme"},{" "}
            {computeAge(profile?.birth_date ?? null)} ans). Formats JPG, PNG ou WebP.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            data-testid="demo-photo-input"
            onChange={(e) => {
              const picked = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (!picked) return;
              const invalid = validatePhotoFile(picked);
              if (invalid) {
                toast.error(invalid);
                return;
              }
              setFile(picked);
            }}
          />
          <Button type="button" variant="outline" onClick={() => input.current?.click()}>
            <ImagePlus aria-hidden />
            {file ? file.name : "Choisir l'image"}
          </Button>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Nature de l'image</legend>
            <RadioGroup
              value={source ?? ""}
              onValueChange={(v) => setSource(v as DemoPhotoSource)}
              className="gap-2"
            >
              {DEMO_PHOTO_SOURCES.map((s) => (
                <Label
                  key={s.value}
                  htmlFor={`demo-source-${s.value}`}
                  className="panel-2 flex cursor-pointer items-start gap-2 p-2 font-normal"
                >
                  <RadioGroupItem
                    id={`demo-source-${s.value}`}
                    value={s.value}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm text-foreground">{s.label}</span>
                    <span className="block text-xs text-muted-foreground">{s.detail}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>
          <Label className="flex items-start gap-2 text-xs font-normal leading-relaxed text-muted-foreground">
            <Checkbox
              checked={attested}
              onCheckedChange={(v) => setAttested(v === true)}
              className="mt-0.5"
              data-testid="demo-attestation"
            />
            J'atteste que cette image n'est pas la photo d'une personne réelle prise sans son accord
            écrit (ni une image tirée d'une telle photo), et j'en assume la responsabilité.
          </Label>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="gold"
            disabled={!file || !source || !attested || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Envoi…" : "Publier la photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
