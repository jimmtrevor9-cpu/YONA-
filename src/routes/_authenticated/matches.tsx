import { createFileRoute } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({
    meta: [
      { title: `Mes Matchs — ${APP_NAME}` },
      { name: "description", content: "Retrouvez les personnes avec qui vous avez un Match." },
      { property: "og:title", content: `Mes Matchs — ${APP_NAME}` },
      {
        property: "og:description",
        content: "Retrouvez les personnes avec qui vous avez un Match.",
      },
    ],
  }),
  component: MatchesPage,
});

/** Page des Matchs de la personne connectée (la liste est affichée à l'étape 3.6). */
function MatchesPage() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Mes Matchs" />
      <main className="mx-auto max-w-md space-y-4 px-5 py-6">
        <p className="eyebrow">Vos Matchs</p>
        <div className="panel p-6 text-center" data-testid="matches-page">
          <p className="text-sm text-muted-foreground">
            Retrouvez ici les personnes avec qui vous vous êtes aimés mutuellement.
          </p>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
