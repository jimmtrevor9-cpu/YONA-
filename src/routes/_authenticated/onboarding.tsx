import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FullProfileEditor } from "@/components/profile/FullProfileEditor";
import { RedirectingScreen } from "@/components/RedirectingScreen";
import { SignupWizard } from "@/components/signup/SignupWizard";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  EMPTY_DRAFT,
  applySignupDraft,
  clearLocalDraft,
  draftFromUser,
  isDraftComplete,
  loadDraftPhotos,
  loadLocalDraft,
  saveLocalDraft,
  sameDraftOwner,
  welcomeKey,
  type SignupDraft,
} from "@/features/auth/signup-draft";
import { FREE_MAX_PHOTOS } from "@/features/monetization/rules";
import { personalInfoServerError } from "@/features/profiles/personal-info";
import { preferencesServerError } from "@/features/profiles/preferences";
import { onboardingDataQuery } from "@/features/profiles/queries";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: `Bienvenue — ${APP_NAME}` },
      { name: "description", content: "Créez votre profil en quelques étapes." },
      { property: "og:title", content: `Bienvenue — ${APP_NAME}` },
      { property: "og:description", content: "Créez votre profil en quelques étapes." },
    ],
  }),
  component: OnboardingPage,
});

function saveErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    personalInfoServerError(message) ??
    preferencesServerError(message) ??
    "Impossible d'enregistrer. Réessayez."
  );
}

/**
 * - Profil déjà terminé : formulaire complet (foi, attentes…) pour le compléter.
 * - Réponses du parcours d'inscription disponibles (même appareil, ou métadonnées du
 *   compte) : le profil est créé automatiquement, sans rien redemander.
 * - Sinon (ex. arrivée directe par Google depuis « Se connecter ») : le parcours
 *   d'inscription s'affiche ici, déjà connecté.
 */
function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { data: saved } = useQuery({ ...onboardingDataQuery(userId), enabled: !!userId });
  const { data: photoCount } = useQuery({
    queryKey: ["photos", "count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase
        .from("photos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      return count ?? 0;
    },
  });

  const [phase, setPhase] = useState<"loading" | "saving" | "done" | "wizard" | "editor">(
    "loading",
  );
  const [initial, setInitial] = useState<SignupDraft>(EMPTY_DRAFT);
  const [initialPhotos, setInitialPhotos] = useState<File[]>([]);
  const started = useRef(false);
  // Compte créé avec Google ou avec un e-mail : seul le libellé de départ change.
  const method = user?.app_metadata?.provider === "google" ? "google" : "email";

  const save = useCallback(
    async (draft: SignupDraft, photos: File[]) => {
      const result = await applySignupDraft(userId, draft, photos);
      clearLocalDraft();
      try {
        window.localStorage.setItem(welcomeKey(userId), "pending");
      } catch {
        // Les fenêtres d'accueil ne s'afficheront simplement pas.
      }
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      await queryClient.invalidateQueries({ queryKey: ["photos"] });
      if (result.photoErrors) {
        toast.error(
          "Une photo n'a pas pu être ajoutée. Vous pourrez la remettre depuis votre profil.",
        );
      }
      // Petit écran « profil prêt », puis la vérification du profil (moins de 2 s).
      setPhase("done");
      window.setTimeout(() => navigate({ to: "/verification", replace: true }), 1200);
    },
    [userId, queryClient, navigate],
  );

  useEffect(() => {
    if (!saved || photoCount === undefined || started.current) return;
    started.current = true;
    if (saved.profile?.onboarding_completed_at) {
      setPhase("editor");
      return;
    }
    const local = loadLocalDraft();
    const fromAccount = draftFromUser(user);
    // Inscription par e-mail : les réponses gardées avec le compte font foi ; les photos du
    // navigateur ne sont reprises que si elles viennent bien de la même personne.
    // Inscription Google : seul le brouillon du navigateur existe.
    const ready = isDraftComplete(fromAccount)
      ? fromAccount
      : isDraftComplete(local) && local.method === "google"
        ? local
        : null;
    const photosFromDevice =
      !!ready && isDraftComplete(local) && (ready === local || sameDraftOwner(local, ready));
    if (ready) {
      setPhase("saving");
      void (async () => {
        try {
          const photos = photosFromDevice ? await loadDraftPhotos() : [];
          await save(ready, photos.slice(0, Math.max(0, FREE_MAX_PHOTOS - photoCount)));
        } catch (error) {
          toast.error(saveErrorMessage(error));
          setInitial({ ...ready, termsAcceptedAt: null });
          setPhase("wizard");
        }
      })();
      return;
    }
    // Parcours à faire ici : on reprend ce qui est déjà connu (prénom donné par Google…).
    const base = local ?? EMPTY_DRAFT;
    setInitial({
      ...base,
      method,
      termsAcceptedAt: null,
      firstName: base.firstName || saved.profile?.first_name || "",
      birthDate: base.birthDate || saved.profile?.birth_date || "",
      gender: base.gender || saved.profile?.gender || "",
    });
    setPhase("wizard");
  }, [saved, photoCount, user, save, method]);

  const remember = useCallback((draft: SignupDraft) => {
    saveLocalDraft({ ...draft, termsAcceptedAt: null });
  }, []);

  if (phase === "editor") return <FullProfileEditor />;

  if (phase === "wizard") {
    return (
      <SignupWizard
        mode="member"
        method={method}
        initial={initial}
        initialPhotos={initialPhotos}
        photoSlots={Math.max(0, FREE_MAX_PHOTOS - (photoCount ?? 0))}
        pending={false}
        onChange={remember}
        onFinish={(draft, photos) => {
          // Écran de chargement aussitôt après la validation, pendant l'enregistrement.
          setInitial({ ...draft, termsAcceptedAt: null });
          setInitialPhotos(photos);
          setPhase("saving");
          void save(draft, photos).catch((error: unknown) => {
            setPhase("wizard");
            toast.error(saveErrorMessage(error));
          });
        }}
      />
    );
  }

  if (phase === "done") {
    return (
      <RedirectingScreen
        message="Ton profil est prêt"
        detail="Dernière étape : la vérification de ton profil…"
      />
    );
  }

  return (
    <div data-testid="onboarding-saving">
      <RedirectingScreen
        message={phase === "saving" ? "On prépare ton profil…" : "Chargement…"}
        detail={phase === "saving" ? "Encore un instant." : undefined}
      />
    </div>
  );
}
