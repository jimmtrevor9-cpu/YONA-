import { createFileRoute } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: `Messages — ${APP_NAME}` },
      { name: "description", content: "Échangez avec les personnes avec qui vous avez un Match." },
      { property: "og:title", content: `Messages — ${APP_NAME}` },
      {
        property: "og:description",
        content: "Échangez avec les personnes avec qui vous avez un Match.",
      },
    ],
  }),
  component: MessagesPage,
});

/** Messagerie de la personne connectée (la liste des conversations est affichée à l'étape 4.3). */
function MessagesPage() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Messages" />
      <main className="mx-auto max-w-md space-y-4 px-5 py-6" data-testid="messages-page">
        <p className="eyebrow">Vos conversations</p>
        <div className="panel p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Retrouvez ici vos conversations avec les personnes avec qui vous avez un Match.
          </p>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
