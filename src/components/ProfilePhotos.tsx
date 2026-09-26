import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, LoaderCircle, Star, Trash2 } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PHOTO_TYPES,
  deletePhoto,
  myPhotosQuery,
  photoErrorMessage,
  setPrimaryPhoto,
  uploadPhoto,
  validatePhotoFile,
  type MyPhoto,
} from "@/features/profiles/photos";

/** Gestion des photos du membre connecté (page Profil). */
export function ProfilePhotos({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useQuery({ ...myPhotosQuery(userId), enabled: !!userId });
  const photos = data?.photos ?? [];
  const max = data?.max ?? 3;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["photos", "me", userId] });
  const onError = (error: unknown) => toast.error(photoErrorMessage(error, max));

  const add = useMutation({
    mutationFn: (file: File) => uploadPhoto(userId, file),
    onSuccess: () => {
      toast.success("Photo ajoutée. Elle sera visible après validation.");
      void refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (photo: MyPhoto) => deletePhoto(photo),
    onSuccess: () => {
      toast.success("Photo supprimée.");
      void refresh();
    },
    onError,
  });
  const makePrimary = useMutation({
    mutationFn: (photo: MyPhoto) => setPrimaryPhoto(photo.id),
    onSuccess: () => {
      toast.success("Photo principale mise à jour.");
      void refresh();
    },
    onError,
  });
  const busy = add.isPending || remove.isPending || makePrimary.isPending;

  function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (photos.length >= max) {
      toast.error(`Vous avez atteint la limite de ${max} photos.`);
      return;
    }
    const error = validatePhotoFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    add.mutate(file);
  }

  return (
    <section className="panel gold-thread space-y-4 p-5" aria-labelledby="photos-title">
      <div className="flex items-center justify-between">
        <p id="photos-title" className="eyebrow">
          Photos
        </p>
        <span className="text-xs text-muted-foreground" data-testid="photos-count">
          {photos.length} / {max}
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : photos.length ? (
        <ul className="grid grid-cols-3 gap-3">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="relative aspect-square overflow-hidden rounded-xl border border-border bg-card"
            >
              {photo.url ? (
                <img src={photo.url} alt="Votre photo" className="size-full object-cover" />
              ) : null}
              <div className="absolute inset-x-1 top-1 flex flex-wrap gap-1">
                {photo.isPrimary ? (
                  <Badge variant="gold" className="bg-background/90">
                    Principale
                  </Badge>
                ) : null}
                {photo.status === "pending" ? (
                  <Badge className="bg-background/90">En attente</Badge>
                ) : null}
                {photo.status === "rejected" ? (
                  <Badge variant="destructive" className="bg-background/90">
                    Refusée
                  </Badge>
                ) : null}
              </div>
              <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1">
                {!photo.isPrimary ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="size-8"
                    disabled={busy}
                    aria-label="Choisir comme photo principale"
                    onClick={() => makePrimary.mutate(photo)}
                  >
                    <Star aria-hidden />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="size-8"
                  disabled={busy}
                  aria-label="Supprimer la photo"
                  onClick={() => remove.mutate(photo)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Aucune photo pour le moment.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        className="hidden"
        aria-label="Choisir une photo"
        onChange={onFileChosen}
      />
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={busy || photos.length >= max}
        onClick={() => inputRef.current?.click()}
      >
        {add.isPending ? (
          <LoaderCircle className="animate-spin" aria-hidden />
        ) : (
          <ImagePlus aria-hidden />
        )}
        {add.isPending ? "Envoi…" : "Ajouter une photo"}
      </Button>
      <p className="text-xs text-muted-foreground">
        JPG, PNG ou WebP, 5 Mo maximum. Vos photos sont visibles par les autres membres après
        validation par notre équipe.
      </p>
    </section>
  );
}
