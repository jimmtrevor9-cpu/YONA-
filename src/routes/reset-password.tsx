import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { translateAuthError, updatePassword } from "@/features/auth/auth.service";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `Nouveau mot de passe — ${APP_NAME}` },
      { name: "description", content: "Définissez un nouveau mot de passe pour votre compte." },
      { property: "og:title", content: `Nouveau mot de passe — ${APP_NAME}` },
      {
        property: "og:description",
        content: "Définissez un nouveau mot de passe pour votre compte.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

const LINK_INVALID_MESSAGE =
  "Ce lien n'est plus valable. Demandez un nouveau lien depuis « Mot de passe oublié ? ».";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [recovery, setRecovery] = useState(true);
  const [linkExpired, setLinkExpired] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    setRecovery(hash.includes("type=recovery") || hash.includes("access_token"));
    // Lien expiré ou déjà utilisé : Supabase renvoie ici avec « #error=…&error_code=otp_expired ».
    setLinkExpired(hash.includes("error="));

    // Le client Supabase consomme le jeton du lien (et vide l'URL) avant cet effet :
    // on reconnaît donc aussi le lien via l'événement de récupération ou la session ouverte.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setRecovery(true);
        setLinkExpired(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!recovery) {
      toast.error(LINK_INVALID_MESSAGE);
      return;
    }
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setPending(true);
    const { error } = await updatePassword(password);
    setPending(false);
    if (error) {
      toast.error(translateAuthError(error.message));
      return;
    }
    toast.success("Mot de passe mis à jour.");
    navigate({ to: "/discover", replace: true });
  }

  return (
    <AuthShell
      eyebrow="Sécurité"
      title="Nouveau mot de passe"
      subtitle={
        recovery
          ? "Choisissez un mot de passe solide, différent de l'ancien."
          : linkExpired
            ? "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau depuis « Mot de passe oublié ? »."
            : "Ouvrez cette page depuis le lien reçu par email."
      }
      footer={
        <Link to="/login" className="text-gold underline-offset-4 hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmation</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Mise à jour…" : "Enregistrer"}
        </Button>
      </form>
    </AuthShell>
  );
}
