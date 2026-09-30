import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";

import { useSignOut } from "@/features/auth/useSignOut";
import { APP_NAME } from "@/lib/config";
import { Button } from "@/components/ui/button";

/** En-tête de l'espace connecté. */
export function AppHeader({ title }: { title: string }) {
  const signOut = useSignOut();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-5 py-3">
        <div className="min-w-0">
          <p className="eyebrow">{APP_NAME}</p>
          <h1 className="truncate font-display text-lg font-semibold text-foreground">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="size-9">
            <Link to="/roi-salomon" aria-label="Roi Salomon, votre conseiller" title="Roi Salomon">
              <Crown className="size-5 text-gold" aria-hidden />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Quitter
          </Button>
        </div>
      </div>
    </header>
  );
}
