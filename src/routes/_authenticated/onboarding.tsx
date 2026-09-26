import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { onboardingDataQuery } from "@/features/profiles/queries";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { APP_NAME } from "@/lib/config";

type Gender = Database["public"]["Enums"]["gender"];

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: `Bienvenue — ${APP_NAME}` },
      { name: "description", content: "Complétez votre profil en trois étapes." },
      { property: "og:title", content: `Bienvenue — ${APP_NAME}` },
      { property: "og:description", content: "Complétez votre profil en trois étapes." },
    ],
  }),
  component: OnboardingPage,
});

const STEPS = ["Vous", "Votre foi", "Vos attentes"] as const;

function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [step, setStep] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [bio, setBio] = useState("");

  const [denomination, setDenomination] = useState("");
  const [churchAttendance, setChurchAttendance] = useState("");
  const [faithImportance, setFaithImportance] = useState("");
  const [marriageVision, setMarriageVision] = useState("");

  const [preferredGender, setPreferredGender] = useState<Gender | "">("");
  const [minAge, setMinAge] = useState(25);
  const [maxAge, setMaxAge] = useState(40);
  const [relationshipGoal, setRelationshipGoal] = useState("");

  // Pré-remplissage avec les données déjà enregistrées (prénom saisi à l'inscription,
  // ou profil complet si l'onboarding est rouvert) pour ne jamais les écraser à vide.
  const queryClient = useQueryClient();
  const { data: saved } = useQuery({ ...onboardingDataQuery(userId), enabled: !!userId });
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (!saved || prefilled) return;
    setPrefilled(true);
    const { profile, faith, prefs } = saved;
    setFirstName(profile?.first_name ?? "");
    setGender(profile?.gender ?? "");
    setBirthDate(profile?.birth_date ?? "");
    setCity(profile?.city ?? "");
    setCountry(profile?.country ?? "");
    setBio(profile?.bio ?? "");
    setDenomination(faith?.denomination ?? "");
    setChurchAttendance(faith?.church_attendance ?? "");
    setFaithImportance(faith?.faith_importance ?? "");
    setMarriageVision(faith?.marriage_vision ?? "");
    // Préférences : valeurs par défaut de l'onboarding tant qu'il n'a jamais été terminé.
    if (profile?.onboarding_completed_at && prefs) {
      setPreferredGender(prefs.preferred_gender ?? "");
      setMinAge(prefs.min_age);
      setMaxAge(prefs.max_age);
      setRelationshipGoal(prefs.relationship_goal ?? "");
    }
  }, [saved, prefilled]);

  /** Étape « Vous » : informations personnelles obligatoires et âge minimum. */
  function personalInfoError() {
    return validatePersonalInfo(
      { firstName, gender, birthDate },
      { requireGender: true, requireBirthDate: true },
    );
  }

  function goNext() {
    if (step === 0) {
      const error = personalInfoError();
      if (error) {
        toast.error(error);
        return;
      }
    }
    setStep(step + 1);
  }

  function submit() {
    const error = personalInfoError();
    if (error) {
      setStep(0);
      toast.error(error);
      return;
    }
    finish.mutate();
  }

  const finish = useMutation({
    mutationFn: async () => {
      const faith = await supabase
        .from("christian_profiles")
        .update({
          denomination: denomination.trim() || null,
          church_attendance: churchAttendance.trim() || null,
          faith_importance: faithImportance.trim() || null,
          marriage_vision: marriageVision.trim() || null,
        })
        .eq("user_id", userId);
      if (faith.error) throw faith.error;

      const prefs = await supabase
        .from("preferences")
        .update({
          preferred_gender: preferredGender || null,
          min_age: minAge,
          max_age: maxAge,
          relationship_goal: relationshipGoal.trim() || null,
        })
        .eq("user_id", userId);
      if (prefs.error) throw prefs.error;

      // Le profil (qui devient actif et visible) est enregistré en dernier : un échec
      // précédent ne laisse jamais un profil visible à moitié rempli.
      const profile = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim() || null,
          gender: gender || null,
          birth_date: birthDate || null,
          city: city.trim() || null,
          country: country.trim() || null,
          bio: bio.trim() || null,
          onboarding_step: STEPS.length,
          onboarding_completed_at: new Date().toISOString(),
          status: "active",
          visibility: "visible",
        })
        .eq("user_id", userId);
      if (profile.error) throw profile.error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Votre profil est prêt.");
      navigate({ to: "/discover", replace: true });
    },
    onError: (error: Error) =>
      toast.error(personalInfoServerError(error.message) ?? "Impossible d'enregistrer. Réessayez."),
  });

  return (
    <main className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        <p className="eyebrow">
          Étape {step + 1} sur {STEPS.length}
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-foreground">{STEPS[step]}</h1>

        <div className="mt-4 flex gap-1.5">
          {STEPS.map((label, index) => (
            <span
              key={label}
              className={`h-0.5 flex-1 rounded-full ${index <= step ? "bg-gold" : "bg-border"}`}
            />
          ))}
        </div>

        <section className="panel gold-thread animate-rise mt-6 space-y-4 p-5">
          {step === 0 ? (
            <>
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
                <Label htmlFor="gender">Je suis</Label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender | "")}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
                >
                  <option value="">À préciser</option>
                  <option value="female">Une femme</option>
                  <option value="male">Un homme</option>
                </select>
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
                <Label htmlFor="bio">Présentation</Label>
                <Textarea
                  id="bio"
                  maxLength={BIO_MAX_LENGTH}
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Quelques lignes sincères sur vous."
                />
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="denomination">Église / dénomination</Label>
                <Input
                  id="denomination"
                  value={denomination}
                  onChange={(e) => setDenomination(e.target.value)}
                  placeholder="Évangélique, catholique, protestante…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="churchAttendance">Fréquentation du culte</Label>
                <Input
                  id="churchAttendance"
                  value={churchAttendance}
                  onChange={(e) => setChurchAttendance(e.target.value)}
                  placeholder="Chaque dimanche"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="faithImportance">Place de la foi dans votre vie</Label>
                <Input
                  id="faithImportance"
                  value={faithImportance}
                  onChange={(e) => setFaithImportance(e.target.value)}
                  placeholder="Centrale, importante…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marriageVision">Votre vision du mariage</Label>
                <Textarea
                  id="marriageVision"
                  rows={4}
                  value={marriageVision}
                  onChange={(e) => setMarriageVision(e.target.value)}
                />
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="preferredGender">Je cherche</Label>
                <select
                  id="preferredGender"
                  value={preferredGender}
                  onChange={(e) => setPreferredGender(e.target.value as Gender | "")}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
                >
                  <option value="">Indifférent</option>
                  <option value="female">Une femme</option>
                  <option value="male">Un homme</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="minAge">Âge minimum</Label>
                  <Input
                    id="minAge"
                    type="number"
                    min={18}
                    max={99}
                    value={minAge}
                    onChange={(e) => setMinAge(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxAge">Âge maximum</Label>
                  <Input
                    id="maxAge"
                    type="number"
                    min={18}
                    max={99}
                    value={maxAge}
                    onChange={(e) => setMaxAge(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="relationshipGoal">Ce que vous recherchez</Label>
                <Input
                  id="relationshipGoal"
                  value={relationshipGoal}
                  onChange={(e) => setRelationshipGoal(e.target.value)}
                  placeholder="Une relation menant au mariage"
                />
              </div>
            </>
          ) : null}
        </section>

        <div className="mt-6 flex gap-3">
          {step > 0 ? (
            <Button variant="secondary" className="flex-1" onClick={() => setStep(step - 1)}>
              Retour
            </Button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <Button className="flex-1" onClick={goNext}>
              Continuer
            </Button>
          ) : (
            <Button className="flex-1" disabled={finish.isPending} onClick={submit}>
              {finish.isPending ? "Enregistrement…" : "Terminer"}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
