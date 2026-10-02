import { Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, ImagePlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PlaceSelect } from "@/components/signup/PlaceSelect";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  AGE_SLIDER_MAX,
  AGE_SLIDER_MIN,
  PASSIONS_MAX,
  PASSION_CHOICES,
  PURPOSE_CHOICES,
  QUALITY_CHOICES,
  WEEKEND_CHOICES,
  ageLabel,
  ageToSlider,
  sliderToAge,
  suggestBio,
  type LookingFor,
  type SignupDraft,
  type SignupMethod,
} from "@/features/auth/signup-draft";
import {
  loadCountries,
  loadRegions,
  normalizePlace,
  type GeoCountry,
  type GeoRegion,
} from "@/features/geo/geo";
import { validatePhotoFile } from "@/features/profiles/photos";
import {
  BIO_MAX_LENGTH,
  FIRST_NAME_MAX_LENGTH,
  OLDEST_BIRTH_DATE,
  PLACE_MAX_LENGTH,
  latestAllowedBirthDate,
  validatePersonalInfo,
} from "@/features/profiles/personal-info";
import { validateAgeRange } from "@/features/profiles/preferences";
import { cn } from "@/lib/utils";

const WIZARD_STEPS = ["Crée ton profil", "Ta bio en 30 s", "Où es-tu ?", "Reste au courant"];
const MAX_SIGNUP_PHOTOS = 3;

export interface WizardAccount {
  email: string;
  password: string;
}

/**
 * Parcours d'inscription en 4 étapes (profil, bio, lieu, « reste au courant »), suivi de
 * la fenêtre des conditions d'utilisation.
 * - mode « guest » : personne pas encore inscrite ; le compte est créé à la fin (e-mail
 *   et mot de passe, ou Google).
 * - mode « member » : déjà connecté (ex. arrivée par Google) ; la fin enregistre le profil.
 */
export function SignupWizard({
  mode,
  method,
  initial,
  initialPhotos = [],
  photoSlots = MAX_SIGNUP_PHOTOS,
  pending,
  onChange,
  onExit,
  onFinish,
}: {
  mode: "guest" | "member";
  method: SignupMethod;
  initial: SignupDraft;
  initialPhotos?: File[];
  photoSlots?: number;
  pending: boolean;
  onChange?: (draft: SignupDraft, photos: File[]) => void;
  onExit?: () => void;
  onFinish: (draft: SignupDraft, photos: File[], account: WizardAccount | null) => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<SignupDraft>(initial);
  const [photos, setPhotos] = useState<File[]>(initialPhotos.slice(0, photoSlots));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bioEdited, setBioEdited] = useState(!!initial.bio);
  const [termsOpen, setTermsOpen] = useState(false);
  const [certified, setCertified] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const update = (patch: Partial<SignupDraft>) =>
    setDraft((d) => {
      const next = { ...d, ...patch };
      // Bio proposée à partir des puces, tant que la personne ne l'a pas réécrite.
      const chipsChanged = "passions" in patch || "weekend" in patch || "quality" in patch;
      if (chipsChanged && !bioEdited && !("bio" in patch)) next.bio = suggestBio(next);
      return next;
    });

  useEffect(() => {
    onChange?.(draft, photos);
  }, [draft, photos, onChange]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
  }, [step]);

  function stepError(index: number): string | null {
    if (index === 0) {
      return (
        validatePersonalInfo(
          { firstName: draft.firstName, gender: draft.gender, birthDate: draft.birthDate },
          { requireGender: true, requireBirthDate: true },
        ) ?? validateAgeRange(draft.minAge, draft.maxAge)
      );
    }
    if (index === 2) {
      if (!draft.country.trim()) return "Indique ton pays.";
      if (!draft.city.trim()) return "Indique ta ville.";
      if (!draft.purpose) return "Dis-nous pourquoi tu es là.";
    }
    if (index === 3 && mode === "guest" && method === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        return "Indique une adresse e-mail valide.";
      if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
    }
    return null;
  }

  function next() {
    const error = stepError(step);
    if (error) {
      toast.error(error);
      return;
    }
    if (step < WIZARD_STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    setCertified(false);
    setTermsOpen(true);
  }

  function back() {
    if (step === 0) onExit?.();
    else setStep(step - 1);
  }

  function accept() {
    // Dernière vérification de toutes les étapes (au cas où une valeur aurait changé).
    for (let i = 0; i < WIZARD_STEPS.length; i++) {
      const error = stepError(i);
      if (error) {
        setTermsOpen(false);
        setStep(i);
        toast.error(error);
        return;
      }
    }
    setTermsOpen(false);
    onFinish(
      { ...draft, termsAcceptedAt: new Date().toISOString() },
      photos,
      mode === "guest" && method === "email" ? { email: email.trim(), password } : null,
    );
  }

  const finishLabel =
    mode === "member"
      ? "Confirmer la création de mon profil"
      : method === "google"
        ? "M'inscrire avec Google"
        : "M'inscrire";

  return (
    <main className="min-h-screen bg-background px-5 pb-28 pt-6">
      <div ref={topRef} className="mx-auto w-full max-w-md">
        <div className="flex items-center gap-3">
          {step > 0 || onExit ? (
            <button
              type="button"
              onClick={back}
              aria-label="Retour"
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}
          <div
            className="flex flex-1 gap-1.5"
            data-testid="signup-progress"
            aria-label={`Étape ${step + 1} sur ${WIZARD_STEPS.length}`}
          >
            {WIZARD_STEPS.map((label, index) => (
              <span
                key={label}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  index <= step ? "bg-gold" : "bg-border",
                )}
              />
            ))}
          </div>
        </div>

        <p className="eyebrow mt-6">
          Étape {step + 1} sur {WIZARD_STEPS.length}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">
          {WIZARD_STEPS[step]}
        </h1>

        <section className="mt-6 space-y-6">
          {step === 0 ? (
            <StepProfile
              draft={draft}
              update={update}
              photos={photos}
              setPhotos={setPhotos}
              photoSlots={photoSlots}
            />
          ) : null}
          {step === 1 ? (
            <StepBio
              draft={draft}
              update={update}
              onBioEdit={(bio) => {
                setBioEdited(true);
                update({ bio });
              }}
            />
          ) : null}
          {step === 2 ? <StepPlace draft={draft} update={update} /> : null}
          {step === 3 ? (
            <StepNews
              draft={draft}
              update={update}
              askAccount={mode === "guest" && method === "email"}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
            />
          ) : null}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md flex-col gap-2">
          <Button
            className="h-auto min-h-12 w-full whitespace-normal rounded-full px-6 py-3 text-base leading-snug"
            disabled={pending}
            onClick={next}
            data-testid="signup-next"
          >
            {pending
              ? "Un instant…"
              : step < WIZARD_STEPS.length - 1
                ? step === 1
                  ? "Continuer"
                  : "Suivant"
                : finishLabel}
          </Button>
          {step === 1 ? (
            <button
              type="button"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                update({ passions: [], weekend: "", quality: "", bio: "" });
                setBioEdited(true);
                setStep(2);
              }}
            >
              Passer cette étape
            </button>
          ) : null}
        </div>
      </div>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent data-testid="terms-dialog" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Conditions d'utilisation</DialogTitle>
            <DialogDescription>
              Avant de continuer, merci de lire et d'accepter nos règles.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>YONA est réservé aux personnes majeures qui cherchent une relation sincère.</li>
            <li>
              Je respecte les autres membres : pas d'insulte, pas d'arnaque, pas de contenu
              choquant.
            </li>
            <li>Mes photos et mes informations sont vraies.</li>
            <li>Je peux bloquer ou signaler un membre à tout moment.</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Lire les{" "}
            <Link
              to="/cgu"
              target="_blank"
              className="text-gold underline-offset-4 hover:underline"
            >
              conditions générales d'utilisation
            </Link>
            .
          </p>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm text-foreground">
            <Checkbox
              id="certify"
              checked={certified}
              onCheckedChange={(v) => setCertified(v === true)}
              className="mt-0.5"
            />
            <span>Je certifie avoir 18 ans ou plus et j'accepte les conditions.</span>
          </label>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="secondary" onClick={() => setTermsOpen(false)}>
              Annuler
            </Button>
            <Button disabled={!certified || pending} onClick={accept} data-testid="terms-accept">
              J'accepte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function Chip({
  selected,
  onClick,
  children,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled && !selected}
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition-colors disabled:opacity-40",
        selected
          ? "border-gold bg-gold/15 font-medium text-foreground"
          : "border-border text-muted-foreground hover:border-gold/60",
      )}
    >
      {children}
    </button>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  name: string;
}) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label={label} data-testid={`choice-${name}`}>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-11 rounded-full border text-sm transition-colors",
              value === option.value
                ? "border-gold bg-gold/15 font-medium text-foreground"
                : "border-border text-muted-foreground hover:border-gold/60",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepProfile({
  draft,
  update,
  photos,
  setPhotos,
  photoSlots,
}: {
  draft: SignupDraft;
  update: (patch: Partial<SignupDraft>) => void;
  photos: File[];
  setPhotos: (files: File[]) => void;
  photoSlots: number;
}) {
  const urls = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos]);
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = [...photos];
    for (const file of Array.from(list)) {
      if (next.length >= photoSlots) break;
      const error = validatePhotoFile(file);
      if (error) {
        toast.error(error);
        continue;
      }
      next.push(file);
    }
    setPhotos(next);
  }

  return (
    <>
      {photoSlots > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2" data-testid="signup-photos">
            {Array.from({ length: photoSlots }, (_, index) => {
              const url = urls[index];
              if (url) {
                return (
                  <div key={index} className="relative aspect-[3/4] overflow-hidden rounded-xl">
                    <img
                      src={url}
                      alt={`Photo ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Retirer la photo ${index + 1}`}
                      onClick={() => setPhotos(photos.filter((_, i) => i !== index))}
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/80 text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              }
              return (
                <div
                  key={index}
                  className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-2"
                >
                  <label className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-full bg-muted px-2 py-1.5 text-xs text-foreground">
                    <ImagePlus className="h-3.5 w-3.5" /> Galerie
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="sr-only"
                      data-testid={index === photos.length ? "photo-gallery" : undefined}
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-full bg-muted px-2 py-1.5 text-xs text-foreground">
                    <Camera className="h-3.5 w-3.5" /> Photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="user"
                      className="sr-only"
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Ajoute 2 photos pour avoir plus de réponses. Tu peux aussi continuer sans photo.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">Prénom</Label>
          <Input
            id="firstName"
            autoComplete="given-name"
            maxLength={FIRST_NAME_MAX_LENGTH}
            value={draft.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
            placeholder="Élise"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="birthDate">Date de naissance</Label>
          <Input
            id="birthDate"
            type="date"
            autoComplete="bday"
            min={OLDEST_BIRTH_DATE}
            max={latestAllowedBirthDate()}
            value={draft.birthDate}
            onChange={(e) => update({ birthDate: e.target.value })}
          />
        </div>
      </div>

      <Segmented
        name="gender"
        label="Je suis"
        value={draft.gender}
        onChange={(gender) => update({ gender })}
        options={[
          { value: "male", label: "Homme" },
          { value: "female", label: "Femme" },
        ]}
      />
      <Segmented<LookingFor>
        name="looking-for"
        label="Je cherche"
        value={draft.lookingFor}
        onChange={(lookingFor) => update({ lookingFor })}
        options={[
          { value: "male", label: "Hommes" },
          { value: "female", label: "Femmes" },
          { value: "all", label: "Tous" },
        ]}
      />

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-foreground">Âge des profils</p>
          <p className="text-sm text-gold" data-testid="age-range">
            {ageLabel(draft.minAge)} – {ageLabel(draft.maxAge)} ans
          </p>
        </div>
        <Slider
          min={AGE_SLIDER_MIN}
          max={AGE_SLIDER_MAX}
          step={1}
          minStepsBetweenThumbs={1}
          value={[ageToSlider(draft.minAge), ageToSlider(draft.maxAge)]}
          onValueChange={([min, max]) =>
            update({
              minAge: sliderToAge(min ?? AGE_SLIDER_MIN),
              maxAge: sliderToAge(max ?? AGE_SLIDER_MAX),
            })
          }
          aria-label="Âge des profils"
        />
      </div>
    </>
  );
}

function StepBio({
  draft,
  update,
  onBioEdit,
}: {
  draft: SignupDraft;
  update: (patch: Partial<SignupDraft>) => void;
  onBioEdit: (bio: string) => void;
}) {
  const togglePassion = (p: string) =>
    update({
      passions: draft.passions.includes(p)
        ? draft.passions.filter((x) => x !== p)
        : [...draft.passions, p].slice(0, PASSIONS_MAX),
    });
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Touche quelques puces : on écrit ta bio pour toi. Tu pourras la modifier.
      </p>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Tes passions <span className="text-muted-foreground">({PASSIONS_MAX} max)</span>
        </p>
        <div className="flex flex-wrap gap-2" data-testid="chips-passions">
          {PASSION_CHOICES.map((p) => (
            <Chip
              key={p}
              selected={draft.passions.includes(p)}
              disabled={draft.passions.length >= PASSIONS_MAX}
              onClick={() => togglePassion(p)}
            >
              {p}
            </Chip>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Ton week-end idéal</p>
        <div className="flex flex-wrap gap-2" data-testid="chips-weekend">
          {WEEKEND_CHOICES.map((w) => (
            <Chip
              key={w}
              selected={draft.weekend === w}
              onClick={() => update({ weekend: draft.weekend === w ? "" : w })}
            >
              {w}
            </Chip>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Ce que tu recherches chez l'autre</p>
        <div className="flex flex-wrap gap-2" data-testid="chips-quality">
          {QUALITY_CHOICES.map((q) => (
            <Chip
              key={q}
              selected={draft.quality === q}
              onClick={() => update({ quality: draft.quality === q ? "" : q })}
            >
              {q}
            </Chip>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">Ta bio</Label>
        <Textarea
          id="bio"
          rows={4}
          maxLength={BIO_MAX_LENGTH}
          value={draft.bio}
          onChange={(e) => onBioEdit(e.target.value)}
          placeholder="Choisis des puces ou écris quelques mots sur toi."
        />
      </div>
    </>
  );
}

function StepPlace({
  draft,
  update,
}: {
  draft: SignupDraft;
  update: (patch: Partial<SignupDraft>) => void;
}) {
  // Listes dépendantes : le pays donne ses régions, la région donne ses villes.
  const [countries, setCountries] = useState<GeoCountry[] | null>(null);
  const [regions, setRegions] = useState<{ code: string; list: GeoRegion[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadCountries()
      .then((list) => !cancelled && setCountries(list))
      .catch(() => !cancelled && setCountries([]));
    return () => {
      cancelled = true;
    };
  }, []);
  const countryCode =
    countries?.find((c) => normalizePlace(c.name) === normalizePlace(draft.country))?.code ?? "";
  useEffect(() => {
    if (!countryCode) return;
    let cancelled = false;
    loadRegions(countryCode)
      .then((list) => !cancelled && setRegions({ code: countryCode, list }))
      .catch(() => !cancelled && setRegions({ code: countryCode, list: [] }));
    return () => {
      cancelled = true;
    };
  }, [countryCode]);
  const regionList = regions && regions.code === countryCode ? regions.list : null;
  const countryNames = useMemo(() => (countries ?? []).map((c) => c.name), [countries]);
  const regionNames = useMemo(() => (regionList ?? []).map((r) => r.name), [regionList]);
  const cityNames = useMemo(() => {
    if (!regionList) return [];
    const region = regionList.find((r) => normalizePlace(r.name) === normalizePlace(draft.region));
    return region ? region.cities : [];
  }, [regionList, draft.region]);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="country">Pays</Label>
        <PlaceSelect
          id="country"
          value={draft.country}
          options={countryNames}
          loading={!countries}
          maxLength={PLACE_MAX_LENGTH}
          onChange={(country) => update({ country, region: "", city: "" })}
          placeholder="Cameroun"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="region">Province / région</Label>
        <PlaceSelect
          id="region"
          value={draft.region}
          options={regionNames}
          loading={!!countryCode && !regionList}
          maxLength={PLACE_MAX_LENGTH}
          onChange={(region) => update({ region, city: "" })}
          placeholder="Littoral"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="city">Ville</Label>
        <PlaceSelect
          id="city"
          value={draft.city}
          options={cityNames}
          loading={!!countryCode && !regionList}
          maxLength={PLACE_MAX_LENGTH}
          onChange={(city) => update({ city })}
          placeholder="Douala"
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Pourquoi tu es là ?</p>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" data-testid="choice-purpose">
          {PURPOSE_CHOICES.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={draft.purpose === p.value}
              onClick={() => update({ purpose: p.value })}
              className={cn(
                "flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border text-sm transition-colors",
                draft.purpose === p.value
                  ? "border-gold bg-gold/15 font-medium text-foreground"
                  : "border-border text-muted-foreground hover:border-gold/60",
              )}
            >
              <span className="text-3xl" aria-hidden>
                {p.emoji}
              </span>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function StepNews({
  draft,
  update,
  askAccount,
  email,
  setEmail,
  password,
  setPassword,
}: {
  draft: SignupDraft;
  update: (patch: Partial<SignupDraft>) => void;
  askAccount: boolean;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
}) {
  return (
    <>
      <div className="panel gold-thread space-y-4 p-5">
        <p className="text-sm text-foreground">
          Veux-tu recevoir par e-mail les nouveautés de YONA et des conseils pour tes rencontres ?
        </p>
        <Segmented<"yes" | "no">
          name="marketing"
          label="E-mails d'actualité"
          value={draft.marketing === null ? "" : draft.marketing ? "yes" : "no"}
          onChange={(v) => update({ marketing: v === "yes" })}
          options={[
            { value: "yes", label: "Oui" },
            { value: "no", label: "Non merci" },
          ]}
        />
      </div>
      {askAccount ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Ton e-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">8 caractères minimum.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
