import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp, translateAuthError } from "@/features/auth/auth.service";
import { APP_NAME } from "@/lib/config";

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

/** Longueur maximale du prénom (contrainte profiles_first_name_length). */
const FIRST_NAME_MAX_LENGTH = 60;

function RegisterPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!firstName.trim()) {
      toast.error("Indiquez votre prénom.");
      return;
    }
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setPending(true);
    const { data, error } = await signUp({
      email: email.trim(),
      password,
      firstName: firstName.trim(),
    });
    setPending(false);
    if (error) {
      toast.error(translateAuthError(error.message));
      return;
    }
    if (!data.session) {
      setSent(true);
      return;
    }
    toast.success("Compte créé.");
    // Confirmation d'email désactivée : la session est ouverte, on complète le profil.
    navigate({ to: "/onboarding", replace: true });
  }

  if (sent) {
    return (
      <AuthShell
        eyebrow="Vérification"
        title="Consultez votre boîte mail"
        subtitle={`Nous avons envoyé un lien de confirmation à ${email}. Cliquez dessus pour activer votre compte.`}
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

  return (
    <AuthShell
      eyebrow="Inscription"
      title="Créer votre compte"
      subtitle="Quelques secondes suffisent. Votre profil se complète ensuite."
      footer={
        <>
          Déjà inscrit ?{" "}
          <Link to="/login" className="text-gold underline-offset-4 hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Prénom</Label>
          <Input
            id="firstName"
            required
            maxLength={FIRST_NAME_MAX_LENGTH}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Élise"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
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
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Création…" : "Créer mon compte"}
        </Button>
      </form>
    </AuthShell>
  );
}
