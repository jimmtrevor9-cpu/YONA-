import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const KEY = "yona.cookies.ok";

/**
 * Bandeau d'information : YONA n'utilise que le stockage nécessaire à la connexion
 * (aucun cookie publicitaire ni de mesure d'audience), donc un simple « OK » suffit.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);
  if (!visible) return null;
  return (
    <div
      data-testid="cookie-banner"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-background/95 p-3 text-xs text-muted-foreground shadow-lg backdrop-blur"
    >
      <p className="flex-1">
        Nous utilisons seulement les cookies nécessaires pour vous garder connecté.{" "}
        <Link to="/cookies" className="text-gold underline-offset-4 hover:underline">
          En savoir plus
        </Link>
      </p>
      <Button
        size="sm"
        onClick={() => {
          try {
            window.localStorage.setItem(KEY, "1");
          } catch {
            // Rien à faire.
          }
          setVisible(false);
        }}
      >
        OK
      </Button>
    </div>
  );
}
