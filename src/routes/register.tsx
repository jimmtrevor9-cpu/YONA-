import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/AuthShell";
import { RedirectingScreen } from "@/components/RedirectingScreen";
import { CookieBanner } from "@/components/signup/CookieBanner";
import { GoogleIcon } from "@/components/signup/GoogleIcon";
import { InstallAppButton } from "@/components/signup/InstallAppButton";
import { RecentSignups } from "@/components/signup/RecentSignups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/AuthProvider";
import { signInWithGoogle, signUp, translateAuthError } from "@/features/auth/auth.service";
import { getPostLoginPath } from "@/features/profiles/queries";
import { BRAND_LOGO_URL, BRAND_SLIDE_URLS } from "@/lib/brand";
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

type Phase = "landing" | "account" | "sent";

/**
 * Inscription, dans cet ordre :
 *   1. Google (ou e-mail + mot de passe) : le compte est créé d'abord ;
 *   2. redirection automatique vers la création du profil (/onboarding) ;
 *   3. étapes du profil, puis vérification du profil.
 */
function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [phase, setPhase] = useState<Phase>("landing");
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState("");

  // Déjà connecté : pas d'inscription, on va directement au bon endroit.
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let cancelled = false;
    void getPostLoginPath(user.id).then((to) => {
      if (!cancelled) navigate({ to, replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, navigate]);

  async function google() {
    setPending(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setPending(false);
      toast.error(translateAuthError(error.message));
    }
    // Sinon le navigateur part chez Google, puis revient pour créer le profil.
  }

  async function createAccount(email: string, password: string) {
    setPending(true);
    const { data, error } = await signUp({ email, password });
    if (error) {
      setPending(false);
      toast.error(translateAuthError(error.message));
      return;
    }
    if (!data.session) {
      // Confirmation d'e-mail activée dans Supabase : le lien mène à la création du profil.
      setPending(false);
      setSentTo(email);
      setPhase("sent");
      return;
    }
    // Session ouverte : la redirection vers la création du profil se fait seule (effet).
  }

  if (isAuthenticated) {
    return <RedirectingScreen message="Compte créé" detail="Place à ton profil…" />;
  }

  if (phase === "sent") {
    return (
      <AuthShell
        eyebrow="Vérification"
        title="Consultez votre boîte mail"
        subtitle={`Nous avons envoyé un lien de confirmation à ${sentTo}. Cliquez dessus pour activer votre compte : vous arriverez directement sur la création de votre profil.`}
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

  if (phase === "account") {
    return (
      <AccountForm
        pending={pending}
        onBack={() => setPhase("landing")}
        onGoogle={() => void google()}
        onSubmit={(email, password) => void createAccount(email, password)}
      />
    );
  }

  return (
    <Landing pending={pending} onEmail={() => setPhase("account")} onGoogle={() => void google()} />
  );
}

function AccountForm({
  pending,
  onBack,
  onGoogle,
  onSubmit,
}: {
  pending: boolean;
  onBack: () => void;
  onGoogle: () => void;
  onSubmit: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error("Indique une adresse e-mail valide.");
      return;
    }
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    onSubmit(cleanEmail, password);
  }

  return (
    <AuthShell
      eyebrow="Inscription"
      title="Crée ton compte"
      subtitle="Ton e-mail et un mot de passe : ensuite, place à ton profil."
      footer={
        <button
          type="button"
          onClick={onBack}
          className="text-gold underline-offset-4 hover:underline"
        >
          Retour
        </button>
      }
    >
      <form onSubmit={submit} className="space-y-4" data-testid="signup-account">
        <div className="space-y-2">
          <Label htmlFor="email">Ton e-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
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
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">8 caractères minimum.</p>
        </div>
        <Button
          type="submit"
          className="h-12 w-full rounded-full text-base"
          disabled={pending}
          data-testid="signup-create-account"
        >
          {pending ? "Un instant…" : "Créer mon compte"}
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> ou
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        disabled={pending}
        onClick={onGoogle}
      >
        <GoogleIcon className="h-4 w-4" /> Continuer avec Google
      </Button>
      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        En continuant, vous acceptez nos{" "}
        <Link to="/cgu" className="underline underline-offset-2">
          conditions d'utilisation
        </Link>{" "}
        et confirmez avoir 18 ans ou plus.
      </p>
    </AuthShell>
  );
}

function Landing({
  pending,
  onEmail,
  onGoogle,
}: {
  pending: boolean;
  onEmail: () => void;
  onGoogle: () => void;
}) {
  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      <div className="relative h-[46vh] min-h-72 w-full overflow-hidden">
        <img
          src={BRAND_SLIDE_URLS[0]}
          alt="Couple chrétien souriant"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-background" />
        <div className="absolute inset-x-0 top-4 flex justify-center px-4">
          <RecentSignups />
        </div>
      </div>

      <div className="relative -mt-16 flex flex-1 flex-col items-center px-6 pb-28 text-center">
        <img src={BRAND_LOGO_URL} alt={APP_NAME} className="h-16 w-auto" />
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
            onClick={onEmail}
            disabled={pending}
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
              onClick={onGoogle}
              disabled={pending}
              aria-label="Continuer avec Google"
              data-testid="signup-google"
              className="grid h-14 w-14 place-items-center rounded-full border border-border bg-white shadow-sm"
            >
              <GoogleIcon className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={onEmail}
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
