import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clientContextHeaders } from "@/integrations/supabase/request-context";

/**
 * Journal des connexions (administration). Toutes ces fonctions échouent en silence :
 * le journal ne doit jamais gêner une connexion ou une déconnexion.
 */

/** Juste après une connexion : appareil, IP, pays, ville et fuseau horaire. */
export const recordSessionContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ timezone: z.string().max(64).optional() }).parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase.rpc("record_session_context", {
      ...(data.timezone ? { _timezone: data.timezone } : {}),
    });
    return { ok: true };
  });

/** Déconnexion (appelée juste avant de fermer la session). */
export const recordLogout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.rpc("record_logout");
    return { ok: true };
  });

/** Connexion échouée : l'adresse saisie (jamais le mot de passe), l'appareil et l'IP. */
export const recordLoginFailure = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({ email: z.string().max(320), method: z.enum(["email", "google"]).default("email") })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const { createSupabaseServiceClient } = await import("@/integrations/supabase/client.server");
      const client = createSupabaseServiceClient(clientContextHeaders(getRequest()));
      if (client) {
        await client.rpc("record_login_failure", { _email: data.email, _method: data.method });
      }
    } catch {
      // Journal indisponible : sans effet pour le visiteur.
    }
    return { ok: true };
  });
