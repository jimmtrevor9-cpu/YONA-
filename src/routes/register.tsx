import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import heroAsset from "@/assets/yona-story-1.jpg.asset.json";
import logoAsset from "@/assets/yona-logo.png.asset.json";
import { AuthShell } from "@/components/AuthShell";
import { CookieBanner } from "@/components/signup/CookieBanner";
import { GoogleIcon } from "@/components/signup/GoogleIcon";
import { InstallAppButton } from "@/components/signup/InstallAppButton";
import { RecentSignups } from "@/components/signup/RecentSignups";
import { SignupWizard, type WizardAccount } from "@/components/signup/SignupWizard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { signInWithGoogle, signUp, translateAuthError } from "@/features/auth/auth.service";
import {
  EMPTY_DRAFT,
  loadLocalDraft,
  saveDraftPhotos,
  saveLocalDraft,
  type SignupDraft,
  type SignupMethod,
} from "@/features/auth/signup-draft";
import { getPostLoginPath } from "@/features/profiles/queries";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: `Créer un compte — ${APP_NAME}` },
      {
        name: "description",
        content: "Rejoignez une communauté chrétienne tournée vers le mariage.",
      },
      { property: "og:title", content: `Créer un compte — ${APP_NAME}` },
      {
        property: "og:description",
        content: "Rejoignez une communauté chrétienne tournée vers le mariage.",
      },
    ],
  }),
  component: RegisterPage,
});

type Phase = "landing" | "wizard" | "sent";

function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [phase, setPhase] = useState<Phase>("landing");
  const [method, setMethod] = useState<SignupMethod>("email");
  const [initial, setInitial] = useState<SignupDraft>(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState("");

  // Déjà connecté : pas d'inscription, on va directement au bon endroit.
  useEffect(() => {
    if (!isAuthenticated || !user || pending) return;
    let cancelled = false;
    void getPostLoginPath(user.id).then((to) => {
      if (!cancelled) navigate({ to, replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, navigate, pending]);

  function start(next: SignupMethod) {
    // Reprise d'un parcours commencé plus tôt sur cet appareil.
    const saved = loadLocalDraft();
    setInitial({ ...(saved ?? EMPTY_DRAFT), method: next, termsAcceptedAt: null });
    setMethod(next);
    setPhase("wizard");
  }

  const remember = useCallback((draft: SignupDraft) => {
    saveLocalDraft({ ...draft, termsAcceptedAt: null });
  }, []);

  async function finish(draft: SignupDraft, photos: File[], account: WizardAccount | null) {
    setPending(true);
    saveLocalDraft(draft);
    await saveDraftPhotos(photos);

    if (method === "google") {
      const { error } = await signInWithGoogle();
      if (error) {
        setPending(false);
        toast.error(translateAuthError(error.message));
      }
      // Sinon le navigateur part chez Google ; le profil est créé au retour (/onboarding).
      return;
    }

    if (!account) {
      setPending(false);
      return;
    }
    const { data, error } = await signUp({
      email: account.email,
      password: account.password,
      firstName: draft.firstName.trim(),
      draft,
    });
    if (error) {
      setPending(false);
      toast.error(translateAuthError(error.message));
      return;
    }
    if (!data.session) {
      setPending(false);
      setSentTo(account.email);
      setPhase("sent");
      return;
    }
    // Confirmation d'e-mail désactivée : la session est ouverte, le profil est créé tout de suite.
    navigate({ to: "/onboarding", replace: true });
  }

  if (phase === "sent") {
    return (
      <AuthShell
        eyebrow="Vérification"
        title="Consultez votre boîte mail"
        subtitle={`Nous avons envoyé un lien de confirmation à ${sentTo}. Cliquez dessus pour activer votre compte : votre profil sera prêt.`}
        footer={
          <Link to="/login" className="text-gold underline-offset-4 hover:underline">
            Retour à la connexion
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          Le lien n'arrive pas ? Vérifiez vos courriers indésirables.
        </p>
      </AuthShell>
    );
  }

  if (phase === "wizard") {
    return (
      <SignupWizard
        mode="guest"
        method={method}
        initial={initial}
        pending={pending}
        onChange={remember}
        onExit={() => setPhase("landing")}
        onFinish={(draft, photos, account) => void finish(draft, photos, account)}
      />
    );
  }

  return <Landing onStart={start} />;
}

function Landing({ onStart }: { onStart: (method: SignupMethod) => void }) {
  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      <div className="relative h-[46vh] min-h-72 w-full overflow-hidden">
        <img
          src={heroAsset.url}
          alt="Couple chrétien souriant"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-background" />
        <div className="absolute inset-x-0 top-4 flex justify-center px-4">
          <RecentSignups />
        </div>
      </div>

      <div className="relative -mt-16 flex flex-1 flex-col items-center px-6 pb-28 text-center">
        <img src={logoAsset.url} alt={APP_NAME} className="h-16 w-auto" />
        <h1 className="mt-3 font-display text-3xl font-semibold text-foreground">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{APP_TAGLINE}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
          {["Chrétiens engagés", "Relations sérieuses", "Photos modérées"].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-gold/40 px-3 py-1 text-foreground"
            >
              {chip}
            </span>
          ))}
        </div>

        <InstallAppButton className="mt-5" />

        <div className="mt-6 w-full max-w-sm space-y-4">
          <Button
            className="h-12 w-full rounded-full text-base"
            onClick={() => onStart("email")}
            data-testid="signup-start"
          >
            Créer mon compte gratuitement
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou continuer avec
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="flex justify-center gap-5">
            <button
              type="button"
              onClick={() => onStart("google")}
              aria-label="Continuer avec Google"
              data-testid="signup-google"
              className="grid h-14 w-14 place-items-center rounded-full border border-border bg-white shadow-sm"
            >
              <GoogleIcon className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => onStart("email")}
              aria-label="Continuer avec mon e-mail"
              data-testid="signup-email"
              className="grid h-14 w-14 place-items-center rounded-full border border-border bg-background text-foreground shadow-sm"
            >
              <Mail className="h-6 w-6" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Déjà membre ?{" "}
            <Link to="/login" className="font-medium text-gold underline-offset-4 hover:underline">
              Se connecter
            </Link>
          </p>
          <p className="text-[11px] text-muted-foreground">
            En continuant, vous acceptez nos{" "}
            <Link to="/cgu" className="underline underline-offset-2">
              conditions d'utilisation
            </Link>{" "}
            et confirmez avoir 18 ans ou plus.
          </p>
        </div>
      </div>
      <CookieBanner />
    </main>
  );
}
