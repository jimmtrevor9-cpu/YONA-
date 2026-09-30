import { useSignOut } from "@/features/auth/useSignOut";
import { APP_NAME } from "@/lib/config";
import { Button } from "@/components/ui/button";

/** En-tête de l'espace connecté. */
export function AppHeader({ title }: { title: string }) {
  const signOut = useSignOut();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
        <div>
          <p className="eyebrow">{APP_NAME}</p>
          <h1 className="font-display text-lg font-semibold text-foreground">{title}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          Quitter
        </Button>
      </div>
    </header>
  );
}
