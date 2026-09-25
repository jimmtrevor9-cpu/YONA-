import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/AuthProvider";
import { signIn, translateAuthError } from "@/features/auth/auth.service";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: `Connexion — ${APP_NAME}` },
      { name: "description", content: "Connectez-vous à votre espace de rencontre chrétienne." },
      { property: "og:title", content: `Connexion — ${APP_NAME}` },
      {
        property: "og:description",
        content: "Connectez-vous à votre espace de rencontre chrétienne.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate({ to: "/discover", replace: true });
  }, [isAuthenticated, navigate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const { error } = await signIn({ email: email.trim(), password });
    setPending(false);
    if (error) {
      toast.error(translateAuthError(error.message));
      return;
    }
    toast.success("Bon retour parmi nous.");
    navigate({ to: "/discover", replace: true });
  }

  return (
    <AuthShell
      eyebrow="Connexion"
      title="Bon retour"
      subtitle="Retrouvez les personnes qui partagent votre foi."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link to="/register" className="text-gold underline-offset-4 hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="text-right">
          <Link
            to="/forgot-password"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </AuthShell>
  );
}
