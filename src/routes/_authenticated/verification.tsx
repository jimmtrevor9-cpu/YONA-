import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Camera,
  Clock,
  IdCard,
  ImagePlus,
  Lock,
  ScanFace,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { LiveSelfieCapture } from "@/components/verification/LiveSelfieCapture";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { myPhotosQuery, photoErrorMessage, validatePhotoFile } from "@/features/profiles/photos";
import { getPostLoginPath } from "@/features/profiles/queries";
import { prepareVerificationImage, replacePrimaryPhoto } from "@/features/profiles/verification";
import {
  DOCUMENT_TYPE_LABELS,
  REASON_MESSAGES,
  START_ERRORS,
  VERIFICATION_TEXT,
  myVerificationStatusQuery,
  uploadVerificationImage,
  verificationErrorText,
} from "@/features/verification/client";
import {
  completeIdentityVerification,
  startIdentityVerification,
  type DocumentType,
  type VerificationStart,
} from "@/features/verification/verification.functions";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/verification")({
  head: () => ({
    meta: [
      { title: `Vérifie ton identité — ${APP_NAME}` },
      {
        name: "description",
        content: "Vérification du profil : protection contre les faux profils et les arnaques.",
      },
    ],
  }),
  component: VerificationPage,
});

/**
 * Tâche F — « Vérifie ton identité » : dernière étape après la création du profil,
 * obligatoire pour découvrir les profils et envoyer des messages. Décision automatique :
 * le serveur compare le visage du selfie en direct (avec consigne) aux photos du profil et,
 * si elle est fournie, à la photo de la pièce. Consentement explicite avant l'envoi ; les
 * images sont privées et supprimées après la décision.
 */
type Choice = "selfie" | "selfie_document" | "document";

function VerificationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const photos = useQuery({ ...myPhotosQuery(userId), enabled: !!userId });
  const status = useQuery({ ...myVerificationStatusQuery(userId), enabled: !!userId });
  const start = useServerFn(startIdentityVerification);
  const complete = useServerFn(completeIdentityVerification);
  const [choice, setChoice] = useState<Choice>("selfie");
  const [documentType, setDocumentType] = useState<DocumentType>("id_card");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [attempt, setAttempt] = useState<VerificationStart | null>(null);
  const [selfieOpen, setSelfieOpen] = useState(false);
  const [result, setResult] = useState<{ status: string; reason: string } | null>(null);
  const idInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  // Profil pas encore créé : retour à la création du profil.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void getPostLoginPath(userId).then((to) => {
      if (!cancelled && to === "/onboarding") navigate({ to, replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, navigate]);

  const primary = photos.data?.photos.find((p) => p.isPrimary) ?? photos.data?.photos[0] ?? null;
  const verified = status.data?.verified ?? false;
  const latest = status.data?.latest ?? null;
  const waiting = !verified && (latest?.status === "pending" || latest?.status === "processing");
  const withDocument = choice !== "selfie";
  const withSelfie = choice !== "document";

  const finish = useCallback(
    async (id: string) => {
      try {
        const outcome = await complete({ data: { id } });
        setResult({ status: outcome.status, reason: outcome.reason });
        if (outcome.status === "approved") {
          toast.success("Identité vérifiée. Bienvenue !");
          window.setTimeout(() => navigate({ to: "/discover", replace: true }), 1800);
        }
      } catch (error) {
        toast.error(verificationErrorText(error));
      } finally {
        setBusy(false);
        setSelfieOpen(false);
        setAttempt(null);
        setDocumentFile(null);
        await queryClient.invalidateQueries({ queryKey: ["verification"] });
        await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      }
    },
    [complete, navigate, queryClient],
  );

  async function begin() {
    if (!consent) {
      toast.error(START_ERRORS["consent_required"]);
      return;
    }
    if (withDocument && !documentFile) {
      toast.error("Ajoute la photo de ta pièce d'identité.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const started = await start({
        data: { withSelfie, consent, ...(withDocument ? { documentType } : {}) },
      });
      if (withDocument && documentFile && started.documentPath) {
        await uploadVerificationImage(
          started.documentPath,
          await prepareVerificationImage(documentFile),
        );
      }
      if (withSelfie && started.challenge) {
        setAttempt(started);
        setSelfieOpen(true);
        return;
      }
      await finish(started.id);
    } catch (error) {
      toast.error(verificationErrorText(error));
      setBusy(false);
    }
  }

  const onCaptured = useCallback(
    async ({ front, turned }: { front: Blob; turned: Blob }) => {
      if (!attempt?.selfiePath || !attempt.challengePath) return;
      try {
        await uploadVerificationImage(attempt.selfiePath, front);
        await uploadVerificationImage(attempt.challengePath, turned);
      } catch (error) {
        toast.error(verificationErrorText(error));
      }
      await finish(attempt.id);
    },
    [attempt, finish],
  );

  async function replacePhoto(file: File) {
    const invalid = validatePhotoFile(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setReplacing(true);
    try {
      await replacePrimaryPhoto(userId, file, primary, photos.data?.hd ?? false);
      await queryClient.invalidateQueries({ queryKey: ["photos"] });
      toast.success("Nouvelle photo envoyée.");
    } catch (error) {
      toast.error(photoErrorMessage(error, photos.data?.max ?? 3));
    } finally {
      setReplacing(false);
    }
  }

  // Pendant une nouvelle tentative, l'ancien résultat n'est plus affiché.
  const shown = busy
    ? null
    : (result ?? (latest && latest.status !== "processing" ? latest : null));

  return (
    <main className="gold-halo min-h-screen bg-background px-4 py-8 sm:py-14">
      <section
        className="panel gold-thread mx-auto w-full max-w-md px-5 pb-7 pt-8 text-center sm:px-7"
        aria-labelledby="verification-title"
        data-testid="verification-page"
      >
        <span className="yona-step-badge mx-auto" aria-hidden>
          <Lock className="size-7" />
        </span>
        <h1
          id="verification-title"
          className="mt-5 text-balance font-display text-2xl font-semibold text-foreground sm:text-3xl"
        >
          Vérifie ton identité
        </h1>
        <p
          className="mx-auto mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground"
          data-testid="verification-explanation"
        >
          {VERIFICATION_TEXT}
        </p>

        {busy && !verified ? (
          <StatusNote
            icon={ScanFace}
            title="Analyse en cours…"
            text="Ton visage est comparé à tes photos de profil. Cela prend quelques secondes."
            testId="verification-checking"
          />
        ) : verified ? (
          <StatusNote
            icon={BadgeCheck}
            title="Identité vérifiée"
            text="Merci, ton profil porte le badge « Profil vérifié »."
            testId="verification-approved"
          />
        ) : waiting && !busy ? (
          <StatusNote
            icon={Clock}
            title="Contrôle complémentaire en cours"
            text={REASON_MESSAGES[latest?.reason ?? "gray_zone"] ?? REASON_MESSAGES["gray_zone"]!}
            testId="verification-pending"
          />
        ) : shown && shown.status === "rejected" ? (
          <StatusNote
            icon={XCircle}
            title="Vérification refusée"
            text={`${REASON_MESSAGES[shown.reason ?? ""] ?? "La vérification n'a pas abouti."} Essais restants aujourd'hui : ${status.data?.attemptsLeft ?? 0}.`}
            testId="verification-rejected"
          />
        ) : null}

        {verified ? (
          <Button asChild className="mt-6 h-12 w-full rounded-full">
            <Link to="/discover" replace>
              Découvrir les profils
            </Link>
          </Button>
        ) : waiting ? null : (
          <div className="mt-7 space-y-4 text-left">
            {/* Ma photo de profil : c'est à elle que le selfie est comparé. */}
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center gap-4">
                <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-accent">
                  {primary?.url ? (
                    <img
                      src={primary.url}
                      alt="Ma photo de profil"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-xl text-accent-foreground">
                      {(user?.user_metadata?.["first_name"] as string | undefined)?.charAt(0) ??
                        "?"}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold text-foreground">
                    Ma photo de profil
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Ton selfie est comparé à tes photos de profil : elles doivent bien te montrer,
                    de face.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-4 h-11 w-full gap-2 rounded-xl border-gold/40 bg-accent/50 text-foreground hover:bg-accent"
                disabled={replacing || photos.isLoading || busy}
                onClick={() => photoInput.current?.click()}
              >
                <ImagePlus className="size-4 text-primary" aria-hidden />
                {replacing ? "Envoi…" : "Remplacer ma photo de profil"}
              </Button>
              <input
                ref={photoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void replacePhoto(file);
                  e.target.value = "";
                }}
              />
            </div>

            <fieldset className="space-y-2" disabled={busy}>
              <legend className="mb-2 font-display text-base font-semibold text-foreground">
                Comment veux-tu te vérifier ?
              </legend>
              <OptionButton
                highlight={choice === "selfie"}
                icon={Camera}
                title="Selfie en direct"
                text="Recommandé : 30 secondes, avec la caméra de ton appareil."
                onClick={() => setChoice("selfie")}
                testId="verify-selfie"
              />
              <OptionButton
                highlight={choice === "selfie_document"}
                icon={ScanFace}
                title="Selfie + pièce d'identité"
                text="Vérification renforcée : ton visage est aussi comparé à ta pièce."
                onClick={() => setChoice("selfie_document")}
                testId="verify-selfie-id"
              />
              <OptionButton
                highlight={choice === "document"}
                icon={IdCard}
                title="Pièce d'identité seule"
                text="Si ta caméra ne fonctionne pas : carte d'identité, passeport, carte d'étudiant ou carte scolaire."
                onClick={() => setChoice("document")}
                testId="verify-id"
              />
            </fieldset>

            {withDocument ? (
              <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
                <label className="block space-y-1 text-sm text-foreground">
                  Type de pièce
                  <select
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                    data-testid="verify-document-type"
                  >
                    {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((t) => (
                      <option key={t} value={t}>
                        {DOCUMENT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full gap-2 rounded-xl"
                  disabled={busy}
                  onClick={() => idInput.current?.click()}
                >
                  <IdCard className="size-4 text-primary" aria-hidden />
                  {documentFile ? `Pièce ajoutée : ${documentFile.name}` : "Photographier ma pièce"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Pièce entière, à plat, sans reflet, photo bien visible. Elle est supprimée dès la
                  décision.
                </p>
                <input
                  ref={idInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  data-testid="verify-document-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setDocumentFile(file);
                    e.target.value = "";
                  }}
                />
              </div>
            ) : null}

            <label className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                data-testid="verify-consent"
              />
              <span>
                J'accepte que {APP_NAME} analyse automatiquement mon visage (donnée biométrique) sur
                mon selfie, mes photos de profil et ma pièce d'identité, uniquement pour vérifier
                mon identité. Les images sont privées et supprimées dès la décision ; seuls le
                résultat, la date, les scores et le type de pièce sont conservés.{" "}
                <Link to="/confidentialite" className="underline underline-offset-2">
                  En savoir plus
                </Link>
              </span>
            </label>

            <Button
              type="button"
              className="h-12 w-full rounded-full"
              disabled={busy || !consent || (withDocument && !documentFile)}
              onClick={() => void begin()}
              data-testid="verify-start"
            >
              {busy ? "Vérification en cours…" : "Commencer la vérification"}
            </Button>
            {status.data ? (
              <p
                className="text-center text-xs text-muted-foreground"
                data-testid="verify-attempts"
              >
                Essais restants aujourd'hui : {status.data.attemptsLeft} sur{" "}
                {status.data.maxAttempts}.
              </p>
            ) : null}
          </div>
        )}

        <p className="mx-auto mt-6 max-w-prose text-xs leading-relaxed text-muted-foreground">
          Tant que ton identité n'est pas vérifiée, tu ne peux ni découvrir les profils ni envoyer
          de messages. Les pages publiques et légales restent accessibles.
        </p>
        {!verified ? (
          <Link
            to="/profile"
            className="mt-4 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Je le ferai plus tard
          </Link>
        ) : null}
      </section>

      {attempt?.challenge ? (
        <LiveSelfieCapture
          open={selfieOpen}
          challenge={attempt.challenge}
          pending={busy}
          onOpenChange={(open) => {
            setSelfieOpen(open);
            if (!open) setBusy(false);
          }}
          onCaptured={(images) => void onCaptured(images)}
        />
      ) : null}
    </main>
  );
}

function OptionButton({
  icon: Icon,
  title,
  text,
  highlight,
  disabled,
  onClick,
  testId,
}: {
  icon: typeof Camera;
  title: string;
  text: string;
  highlight?: boolean;
  disabled?: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors disabled:opacity-60",
        highlight
          ? "border-primary/40 bg-accent hover:border-primary/70"
          : "border-border bg-surface hover:border-gold/50",
      )}
    >
      <span
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-xl",
          highlight ? "bg-primary text-primary-foreground" : "bg-surface-2 text-gold",
        )}
        aria-hidden
      >
        <Icon className="size-6" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-base font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}

function StatusNote({
  icon: Icon,
  title,
  text,
  testId,
}: {
  icon: typeof Camera;
  title: string;
  text: string;
  testId?: string;
}) {
  return (
    <div
      className="mt-5 flex items-start gap-3 rounded-2xl border border-gold/30 bg-accent/50 p-4 text-left"
      data-testid={testId}
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
