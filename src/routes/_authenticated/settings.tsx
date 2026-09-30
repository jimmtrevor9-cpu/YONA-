import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useId, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import {
  DELETE_ACCOUNT_CONFIRMATION,
  accountErrorMessage,
  deleteMyAccount,
} from "@/features/account/account.functions";
import { useAuth } from "@/features/auth/AuthProvider";
import { myProfileQuery } from "@/features/profiles/queries";
import {
  PASSWORD_MIN_LENGTH,
  type UserSettings,
  blockedUsersQuery,
  changePassword,
  saveProfileVisibility,
  saveSetting,
  settingsQuery,
} from "@/features/settings/queries";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: `Paramètres — ${APP_NAME}` },
      { name: "description", content: "Confidentialité, notifications et compte." },
    ],
  }),
  component: SettingsPage,
});

/** Ligne « libellé + interrupteur ». */
function ToggleRow({
  label,
  help,
  checked,
  disabled,
  onChange,
  testId,
}: {
  label: string;
  help: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  testId: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm text-foreground">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        data-testid={testId}
      />
    </div>
  );
}

/** 20.1 à 20.9 — Paramètres du compte. */
function SettingsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useQuery({ ...myProfileQuery(userId), enabled: !!userId });
  const { data: settings } = useQuery({ ...settingsQuery(userId), enabled: !!userId });
  const { data: blocked } = useQuery({ ...blockedUsersQuery(userId), enabled: !!userId });

  const setSetting = useMutation({
    mutationFn: (patch: Partial<UserSettings>) => saveSetting(userId, patch),
    onSuccess: () => {
      toast.success("Réglage enregistré.");
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => toast.error("Le réglage n'a pas pu être enregistré."),
  });
  const setVisibility = useMutation({
    mutationFn: (visible: boolean) => saveProfileVisibility(userId, visible),
    onSuccess: () => {
      toast.success("Visibilité du profil enregistrée.");
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: () => toast.error("La visibilité n'a pas pu être changée."),
  });
  const unblock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("unblock_user", { _user_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membre débloqué.");
      void queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const passwordError =
    next && next.length < PASSWORD_MIN_LENGTH
      ? `${PASSWORD_MIN_LENGTH} caractères au moins.`
      : confirm && confirm !== next
        ? "Les deux mots de passe ne sont pas identiques."
        : null;
  const password = useMutation({
    mutationFn: () => changePassword(user?.email ?? "", current, next),
    onSuccess: () => {
      toast.success("Mot de passe changé.");
      setCurrent("");
      setNext("");
      setConfirm("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteWord, setDeleteWord] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const removeAccount = useServerFn(deleteMyAccount);
  const deletion = useMutation({
    mutationFn: () =>
      removeAccount({ data: { confirmation: deleteWord, password: deletePassword } }),
    onSuccess: async () => {
      queryClient.clear();
      await supabase.auth.signOut({ scope: "local" });
      toast.success("Votre compte a été supprimé. Que Dieu vous bénisse.");
      void navigate({ to: "/", replace: true });
    },
    onError: (error) => toast.error(accountErrorMessage(error)),
  });

  const s = settings;
  const visible = profile?.visibility !== "hidden";

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Paramètres" />
      <main className="mx-auto max-w-md space-y-5 px-5 py-6" data-testid="settings-page">
        <section className="panel space-y-1 p-5" aria-labelledby="privacy-title">
          <p id="privacy-title" className="eyebrow">
            Confidentialité
          </p>
          <ToggleRow
            label="Profil visible"
            help="Masqué : les autres membres ne voient plus votre profil."
            checked={visible}
            disabled={!profile || setVisibility.isPending}
            onChange={(v) => setVisibility.mutate(v)}
            testId="setting-profile-visible"
          />
          <ToggleRow
            label="Activité visible"
            help="Masquée : personne ne voit si vous êtes en ligne ou votre dernière activité."
            checked={s?.activity_visible ?? true}
            disabled={!s || setSetting.isPending}
            onChange={(v) => setSetting.mutate({ activity_visible: v })}
            testId="setting-activity-visible"
          />
        </section>

        <section className="panel space-y-1 p-5" aria-labelledby="notif-title">
          <p id="notif-title" className="eyebrow">
            Notifications
          </p>
          <ToggleRow
            label="Nouveaux messages"
            help="Être prévenu quand un Match vous écrit."
            checked={s?.notify_messages ?? true}
            disabled={!s || setSetting.isPending}
            onChange={(v) => setSetting.mutate({ notify_messages: v })}
            testId="setting-notify-messages"
          />
          <ToggleRow
            label="Nouveaux Matchs"
            help="Être prévenu d'un nouveau Match."
            checked={s?.notify_matches ?? true}
            disabled={!s || setSetting.isPending}
            onChange={(v) => setSetting.mutate({ notify_matches: v })}
            testId="setting-notify-matches"
          />
          <ToggleRow
            label="Likes reçus"
            help="Être prévenu quand quelqu'un vous envoie un Like."
            checked={s?.notify_likes ?? true}
            disabled={!s || setSetting.isPending}
            onChange={(v) => setSetting.mutate({ notify_likes: v })}
            testId="setting-notify-likes"
          />
          <ToggleRow
            label="Notifications par e-mail"
            help="Recevoir aussi un résumé par e-mail (dès que l'envoi d'e-mails sera activé)."
            checked={s?.notify_email ?? true}
            disabled={!s || setSetting.isPending}
            onChange={(v) => setSetting.mutate({ notify_email: v })}
            testId="setting-notify-email"
          />
        </section>

        <form
          className="panel space-y-3 p-5"
          aria-labelledby="password-title"
          onSubmit={(e) => {
            e.preventDefault();
            if (!passwordError && current && next && confirm) password.mutate();
          }}
        >
          <p id="password-title" className="eyebrow">
            Mot de passe
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Mot de passe actuel</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirmer le nouveau mot de passe</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {passwordError ? (
            <p className="text-xs text-destructive" role="alert">
              {passwordError}
            </p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            disabled={!!passwordError || !current || !next || !confirm || password.isPending}
          >
            {password.isPending ? "Enregistrement…" : "Changer le mot de passe"}
          </Button>
        </form>

        <section className="panel space-y-3 p-5" aria-labelledby="blocked-title">
          <p id="blocked-title" className="eyebrow">
            Membres bloqués
          </p>
          {blocked?.length ? (
            <ul className="space-y-2" data-testid="blocked-list">
              {blocked.map((b) => (
                <li key={b.user_id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">{b.first_name ?? "Membre"}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={unblock.isPending}
                    onClick={() => unblock.mutate(b.user_id)}
                  >
                    Débloquer
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid="blocked-empty">
              Vous n'avez bloqué personne.
            </p>
          )}
        </section>

        <section
          className="panel space-y-3 border-destructive/40 p-5"
          aria-labelledby="delete-title"
        >
          <p id="delete-title" className="eyebrow text-destructive">
            Supprimer mon compte
          </p>
          <p className="text-xs text-muted-foreground">
            Action définitive : profil, photos, Matchs et messages seront effacés. Un abonnement en
            cours n'est pas remboursé.
          </p>
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={() => setDeleteOpen(true)}
            data-testid="delete-account-open"
          >
            Supprimer mon compte
          </Button>
        </section>
      </main>

      <Dialog open={deleteOpen} onOpenChange={(o) => !deletion.isPending && setDeleteOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer définitivement votre compte ?</DialogTitle>
            <DialogDescription>
              Écrivez {DELETE_ACCOUNT_CONFIRMATION} et votre mot de passe pour confirmer. Cette
              action ne peut pas être annulée.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              deletion.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="delete-word">Confirmation</Label>
              <Input
                id="delete-word"
                value={deleteWord}
                onChange={(e) => setDeleteWord(e.target.value)}
                placeholder={DELETE_ACCOUNT_CONFIRMATION}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delete-password">Mot de passe</Label>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={deletion.isPending}
                onClick={() => setDeleteOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={
                  deleteWord.trim().toUpperCase() !== DELETE_ACCOUNT_CONFIRMATION ||
                  !deletePassword ||
                  deletion.isPending
                }
              >
                {deletion.isPending ? "Suppression…" : "Supprimer définitivement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <BottomNav />
    </div>
  );
}
