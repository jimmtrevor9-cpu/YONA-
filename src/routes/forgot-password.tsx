import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, translateAuthError } from "@/features/auth/auth.service";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: `Mot de passe oublié — ${APP_NAME}` },
      { name: "description", content: "Recevez un lien pour réinitialiser votre mot de passe." },
      { property: "og:title", content: `Mot de passe oublié — ${APP_NAME}` },
      {
        property: "og:description",
        content: "Recevez un lien pour réinitialiser votre mot de passe.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const { error } = await requestPasswordReset(email.trim());
    setPending(false);
    if (error) {
      toast.error(translateAuthError(error.message));
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell
      eyebrow="Récupération"
      title="Mot de passe oublié"
      subtitle={
        sent
          ? undefined
          : "Indiquez votre email : nous vous envoyons un lien de réinitialisation."
      }
      footer={
        <Link to="/login" className="text-gold underline-offset-4 hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-muted-foreground">
          Si un compte existe pour {email}, un lien de réinitialisation vient d'être envoyé.
        </p>
      ) : (
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
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Envoi…" : "Envoyer le lien"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
