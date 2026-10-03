import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ImagePlus, MapPin, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { InstallAppButton } from "@/components/signup/InstallAppButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { welcomeKey } from "@/features/auth/signup-draft";
import { FAITH_SHORT_MAX_LENGTH } from "@/features/profiles/christian-info";
import { locationErrorMessage } from "@/features/profiles/location";
import { photoErrorMessage, uploadPhoto, validatePhotoFile } from "@/features/profiles/photos";
import { useShareDeviceLocation } from "@/features/location/useDeviceLocation";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Step = "welcome" | "photo" | "location" | "complete";

const ATTENDANCE_CHOICES = ["Chaque semaine", "Souvent", "De temps en temps"] as const;
const ORIGIN_MAX_LENGTH = 60;

/**
 * Fenêtres affichées une seule fois, juste après l'inscription, sur la page Découvrir :
 * bienvenue, 2e photo, position, puis « Complète ton profil en 20 secondes ».
 * Les fenêtres inutiles sont sautées (ex. déjà 2 photos, position déjà enregistrée).
 */
export function WelcomeSequence({ userId, firstName }: { userId: string; firstName: string }) {
  const queryClient = useQueryClient();
  const shareLocation = useShareDeviceLocation();
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const [hasChildren, setHasChildren] = useState<"yes" | "no" | "">("");
  const [origin, setOrigin] = useState("");
  const [denomination, setDenomination] = useState("");
  const [attendance, setAttendance] = useState("");

  useEffect(() => {
    if (!userId) return;
    let pendingFlag = false;
    try {
      pendingFlag = window.localStorage.getItem(welcomeKey(userId)) === "pending";
    } catch {
      pendingFlag = false;
    }
    if (!pendingFlag) return;
    let cancelled = false;
    void (async () => {
      const [photos, location] = await Promise.all([
        supabase.from("photos").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("profile_locations").select("user_id").eq("user_id", userId).maybeSingle(),
      ]);
      if (cancelled) return;
      const count = photos.count ?? 0;
      setPhotoCount(count);
      const list: Step[] = ["welcome"];
      if (count < 2) list.push("photo");
      if (!location.data) list.push("location");
      list.push("complete");
      setSteps(list);
      setIndex(0);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const step = steps[index];

  function next() {
    if (index + 1 < steps.length) {
      setIndex(index + 1);
      return;
    }
    try {
      window.localStorage.setItem(welcomeKey(userId), "done");
    } catch {
      // Rien à faire.
    }
    setSteps([]);
  }

  async function addPhoto(file: File | undefined) {
    if (!file) return;
    const error = validatePhotoFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setBusy(true);
    try {
      await uploadPhoto(userId, file);
      await queryClient.invalidateQueries({ queryKey: ["photos"] });
      toast.success("Photo ajoutée. Elle sera visible après vérification.");
      next();
    } catch (err) {
      toast.error(photoErrorMessage(err, 3));
    } finally {
      setBusy(false);
    }
  }

  async function enableLocation() {
    setBusy(true);
    try {
      await shareLocation();
      await queryClient.invalidateQueries({ queryKey: ["profiles", "location"] });
      toast.success("Position activée.");
      next();
    } catch (err) {
      toast.error(locationErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveComplete() {
    setBusy(true);
    try {
      const profile = await supabase
        .from("profiles")
        .update({
          has_children: hasChildren === "" ? null : hasChildren === "yes",
          origin: origin.trim() || null,
        })
        .eq("user_id", userId);
      if (profile.error) throw profile.error;
      if (denomination.trim() || attendance) {
        const faith = await supabase
          .from("christian_profiles")
          .update({
            denomination: denomination.trim() || null,
            church_attendance: attendance || null,
          })
          .eq("user_id", userId);
        if (faith.error) throw faith.error;
      }
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Profil enregistré.");
      next();
    } catch {
      toast.error("Impossible d'enregistrer. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!step} onOpenChange={(open) => (!open ? next() : undefined)}>
      <DialogContent className="max-w-sm" data-testid={step ? `welcome-${step}` : undefined}>
        {step === "welcome" ? (
          <>
            <DialogHeader>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold/15 text-gold">
                <Sparkles className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center">Bienvenue {firstName} !</DialogTitle>
              <DialogDescription className="text-center">
                Ton profil est en ligne. Découvre les célibataires chrétiens qui partagent ta foi.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center">
              <InstallAppButton />
            </div>
            <DialogFooter>
              <Button className="w-full" onClick={next}>
                C'est parti
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {step === "photo" ? (
          <>
            <DialogHeader>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold/15 text-gold">
                <ImagePlus className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center">
                {photoCount === 0
                  ? "Ajoute ta première photo"
                  : "Une seule photo ne te rend pas justice"}
              </DialogTitle>
              <DialogDescription className="text-center">
                Les profils avec au moins 2 photos reçoivent beaucoup plus de réponses.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <label
                className={cn(
                  "inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground",
                  busy && "pointer-events-none opacity-60",
                )}
              >
                {busy ? "Envoi…" : "Ajouter une photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  data-testid="welcome-photo-input"
                  onChange={(e) => {
                    void addPhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <Button variant="ghost" className="w-full" onClick={next}>
                Plus tard
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {step === "location" ? (
          <>
            <DialogHeader>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold/15 text-gold">
                <MapPin className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center">Découvre qui est tout près</DialogTitle>
              <DialogDescription className="text-center">
                Pour te montrer des personnes près de chez toi, active ta position. Elle n'est
                jamais montrée aux autres membres.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button className="w-full" disabled={busy} onClick={() => void enableLocation()}>
                {busy ? "Un instant…" : "Activer ma position"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={next}>
                Plus tard
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {step === "complete" ? (
          <>
            <DialogHeader>
              <DialogTitle>Complète ton profil en 20 secondes</DialogTitle>
              <DialogDescription>
                Ces informations aident à trouver une personne vraiment compatible.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">As-tu des enfants ?</p>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Enfants">
                  {(
                    [
                      ["yes", "Oui"],
                      ["no", "Non"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={hasChildren === value}
                      onClick={() => setHasChildren(value)}
                      className={cn(
                        "h-10 rounded-full border text-sm",
                        hasChildren === value
                          ? "border-gold bg-gold/15 font-medium text-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="origin">Origine</Label>
                <Input
                  id="origin"
                  maxLength={ORIGIN_MAX_LENGTH}
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Ex. camerounaise, ivoirienne…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="welcomeDenomination">Église / dénomination</Label>
                <Input
                  id="welcomeDenomination"
                  maxLength={FAITH_SHORT_MAX_LENGTH}
                  value={denomination}
                  onChange={(e) => setDenomination(e.target.value)}
                  placeholder="Évangélique, catholique, protestante…"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Tu vas au culte…</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Culte">
                  {ATTENDANCE_CHOICES.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      role="radio"
                      aria-checked={attendance === choice}
                      onClick={() => setAttendance(attendance === choice ? "" : choice)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm",
                        attendance === choice
                          ? "border-gold bg-gold/15 font-medium text-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Tu pourras tout compléter plus tard dans{" "}
                <Link to="/onboarding" className="text-gold underline-offset-4 hover:underline">
                  Ma foi et mes attentes
                </Link>
                .
              </p>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button className="w-full" disabled={busy} onClick={() => void saveComplete()}>
                {busy ? "Enregistrement…" : "Enregistrer mon profil"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={next}>
                Passer pour l'instant
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
