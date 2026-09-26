import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { ProfilePhotos } from "@/components/ProfilePhotos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  BIO_MAX_LENGTH,
  FIRST_NAME_MAX_LENGTH,
  OLDEST_BIRTH_DATE,
  PLACE_MAX_LENGTH,
  latestAllowedBirthDate,
  personalInfoServerError,
  validatePersonalInfo,
} from "@/features/profiles/personal-info";
import { computeAge, myProfileQuery } from "@/features/profiles/queries";
import {
  PROFILE_VISIBILITY_MESSAGES,
  profileVisibilityState,
} from "@/features/profiles/visibility";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: `Mon profil — ${APP_NAME}` },
      { name: "description", content: "Complétez et mettez à jour votre profil." },
      { property: "og:title", content: `Mon profil — ${APP_NAME}` },
      { property: "og:description", content: "Complétez et mettez à jour votre profil." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ ...myProfileQuery(userId), enabled: !!userId });

  const [firstName, setFirstName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [profession, setProfession] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!data) return;
    setFirstName(data.first_name ?? "");
    setBirthDate(data.birth_date ?? "");
    setCity(data.city ?? "");
    setCountry(data.country ?? "");
    setProfession(data.profession ?? "");
    setBio(data.bio ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim() || null,
          birth_date: birthDate || null,
          city: city.trim() || null,
          country: country.trim() || null,
          profession: profession.trim() || null,
          bio: bio.trim() || null,
        })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil enregistré.");
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (error: Error) =>
      toast.error(
        personalInfoServerError(error.message) ?? "Enregistrement impossible. Réessayez.",
      ),
  });

  const age = computeAge(birthDate);
  const visibility = data ? profileVisibilityState(data) : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Mon profil" />
      <main className="mx-auto max-w-md space-y-5 px-5 py-6">
        {isLoading ? (
          <Skeleton className="h-80 w-full rounded-2xl" />
        ) : (
          <>
            {data && visibility === "incomplete" ? (
              <div
                className="panel-2 flex items-center justify-between gap-3 p-4"
                data-testid="profile-visibility"
              >
                <p className="text-xs text-muted-foreground">
                  Votre profil n'est pas finalisé : il n'est pas encore visible par les autres
                  membres.
                </p>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/onboarding">Continuer</Link>
                </Button>
              </div>
            ) : null}
            {data && visibility && visibility !== "incomplete" ? (
              <div className="panel-2 flex items-center gap-3 p-4" data-testid="profile-visibility">
                {visibility === "visible" ? (
                  <Eye className="size-4 shrink-0 text-gold-soft" aria-hidden />
                ) : (
                  <EyeOff className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <p className="text-xs text-muted-foreground">
                  {PROFILE_VISIBILITY_MESSAGES[visibility]}
                </p>
              </div>
            ) : null}

            <ProfilePhotos userId={userId} />

            <form
              className="panel gold-thread space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                const error = validatePersonalInfo(
                  { firstName, birthDate },
                  // Une fois le profil créé, la date de naissance ne peut plus être effacée.
                  { requireGender: false, requireBirthDate: !!data?.onboarding_completed_at },
                );
                if (error) {
                  toast.error(error);
                  return;
                }
                save.mutate();
              }}
            >
              <p className="eyebrow">Informations</p>

              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  maxLength={FIRST_NAME_MAX_LENGTH}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthDate">Date de naissance</Label>
                <Input
                  id="birthDate"
                  type="date"
                  min={OLDEST_BIRTH_DATE}
                  max={latestAllowedBirthDate()}
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
                {age ? <p className="text-xs text-muted-foreground">{age} ans</p> : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    maxLength={PLACE_MAX_LENGTH}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Pays</Label>
                  <Input
                    id="country"
                    maxLength={PLACE_MAX_LENGTH}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profession">Profession</Label>
                <Input
                  id="profession"
                  maxLength={PLACE_MAX_LENGTH}
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Présentation</Label>
                <Textarea
                  id="bio"
                  maxLength={BIO_MAX_LENGTH}
                  rows={5}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Parlez de votre foi, de votre quotidien, de ce que vous cherchez."
                />
              </div>

              <Button type="submit" className="w-full" disabled={save.isPending}>
                {save.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </form>

            <p className="text-center text-[11px] text-muted-foreground">
              Préférences avancées et abonnement Premium arrivent en Phase 2.
            </p>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
