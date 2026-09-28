import { createFileRoute, Link } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/visiteurs")({
  head: () => ({
    meta: [
      { title: `Mes visiteurs — ${APP_NAME}` },
      { name: "description", content: "Découvrez qui a consulté votre profil." },
      { property: "og:title", content: `Mes visiteurs — ${APP_NAME}` },
      { property: "og:description", content: "Découvrez qui a consulté votre profil." },
    ],
  }),
  component: VisitorsPage,
});

/** Page Visiteurs de la personne connectée. */
function VisitorsPage() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Mes visiteurs" />
      <main className="mx-auto max-w-md space-y-4 px-5 py-6" data-testid="visitors-page">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Qui a visité votre profil</p>
          <Link to="/profile" className="text-xs text-muted-foreground hover:text-foreground">
            Retour au profil
          </Link>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="visitors-explanation">
          Une visite est comptée quand un membre ouvre votre profil complet, au plus une fois par
          heure.
        </p>
      </main>
      <BottomNav />
    </div>
  );
}
