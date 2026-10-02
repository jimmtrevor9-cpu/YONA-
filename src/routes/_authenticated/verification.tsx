import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Camera, Clock, IdCard, ImagePlus, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { RedirectingScreen } from "@/components/RedirectingScreen";
import { SelfieCapture } from "@/components/verification/SelfieCapture";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { myPhotosQuery, photoErrorMessage, validatePhotoFile } from "@/features/profiles/photos";
import { getPostLoginPath } from "@/features/profiles/queries";
import {
  myVerificationsQuery,
  replacePrimaryPhoto,
  submitVerification,
  verificationErrorMessage,
  type VerificationMethod,
} from "@/features/profiles/verification";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/verification")({
  head: () => ({
    meta: [
      { title: `Vérifie ton profil — ${APP_NAME}` },
      {
        name: "description",
        content: "Vérification du profil : protection contre les faux profils et les arnaques.",
      },
    ],
  }),
  component: VerificationPage,
});

/**
 * « Vérifie ton profil pour continuer » : affichée juste après la création du profil.
 * Selfie express (recommandé) ou pièce d'identité ; les photos vont dans un espace privé
 * et ne sont jamais publiées.
 */
function VerificationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const photos = useQuery({ ...myPhotosQuery(userId), enabled: !!userId });
  const verifications = useQuery({ ...myVerificationsQuery(userId), enabled: !!userId });
  const [selfieOpen, setSelfieOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [sent, setSent] = useState(false);
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

  // Après l'envoi : petit écran de confirmation, puis la découverte des profils.
  useEffect(() => {
    if (!sent) return;
    const id = window.setTimeout(() => navigate({ to: "/discover", replace: true }), 1800);
    return () => window.clearTimeout(id);
  }, [sent, navigate]);

  const primary = photos.data?.photos.find((p) => p.isPrimary) ?? photos.data?.photos[0] ?? null;
  const latest = verifications.data?.[0];
  const approved = verifications.data?.some((v) => v.status === "approved") ?? false;
  const waiting = !approved && latest?.status === "pending";

  async function send(method: VerificationMethod, image: Blob) {
    if (!userId) return;
    setSending(true);
    try {
      await submitVerification(userId, method, image);
      await queryClient.invalidateQueries({ queryKey: ["verifications"] });
      setSelfieOpen(false);
      setSent(true);
    } catch (error) {
      toast.error(verificationErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

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
      toast.success("Nouvelle photo envoyée : elle sera visible après validation par l'équipe.");
    } catch (error) {
      toast.error(photoErrorMessage(error, photos.data?.max ?? 3));
    } finally {
      setReplacing(false);
    }
  }

  if (sent) {
    return (
      <RedirectingScreen
        message="Merci, c'est envoyé !"
        detail="Notre équipe vérifie ton profil. Place aux rencontres…"
      />
    );
  }

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
          Vérifie ton profil pour continuer
        </h1>
        <p className="mx-auto mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Pour protéger la communauté {APP_NAME} des faux profils et des arnaques, chaque membre
          vérifie son profil. Cela prend moins d'une minute, et tes photos de vérification restent
          privées.
        </p>

        {approved ? (
          <StatusNote
            icon={BadgeCheck}
            title="Profil vérifié"
            text="Merci, ton profil est vérifié."
          />
        ) : waiting ? (
          <StatusNote
            icon={Clock}
            title="Vérification en cours"
            text="Nous avons bien reçu ton envoi. Notre équipe l'examine : tu peux déjà continuer."
          />
        ) : null}

        <div className="mt-7 space-y-3 text-left">
          {/* Ma photo de profil */}
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
                    {(user?.user_metadata?.["first_name"] as string | undefined)?.charAt(0) ?? "?"}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-display text-base font-semibold text-foreground">
                  Ma photo de profil
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Si notre équipe te demande de la changer, remplace-la ici.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-4 h-11 w-full gap-2 rounded-xl border-gold/40 bg-accent/50 text-foreground hover:bg-accent"
              disabled={replacing || photos.isLoading}
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

          {/* Selfie express */}
          <OptionButton
            highlight
            icon={Camera}
            title="Selfie express"
            text="Recommandé : 30 secondes, aucun document à fournir."
            disabled={sending}
            onClick={() => setSelfieOpen(true)}
            testId="verify-selfie"
          />

          {/* Pièce d'identité */}
          <OptionButton
            icon={IdCard}
            title="Avec ma pièce d'identité"
            text="Carte d'identité ou passeport : vérification renforcée."
            disabled={sending}
            onClick={() => idInput.current?.click()}
            testId="verify-id"
          />
          <input
            ref={idInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void send("id_document", file);
              e.target.value = "";
            }}
          />
        </div>

        <p className="mx-auto mt-6 max-w-prose text-xs leading-relaxed text-muted-foreground">
          Tes photos de vérification restent strictement privées&nbsp;: elles ne sont jamais
          publiées et servent uniquement à confirmer ton identité.
        </p>
        <Link
          to="/discover"
          replace
          className="mt-5 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {approved || waiting ? "Continuer" : "Je le ferai plus tard"}
        </Link>
      </section>

      <SelfieCapture
        open={selfieOpen}
        onOpenChange={setSelfieOpen}
        pending={sending}
        onSend={(image) => void send("selfie", image)}
      />
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
}: {
  icon: typeof Camera;
  title: string;
  text: string;
}) {
  return (
    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-gold/30 bg-accent/50 p-4 text-left">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
