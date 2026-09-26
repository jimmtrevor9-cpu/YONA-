import { supabase } from "@/integrations/supabase/client";

/** Traduction des erreurs d'authentification les plus courantes. */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Veuillez confirmer votre email avant de vous connecter.";
  if (m.includes("user already registered")) return "Un compte existe déjà avec cet email.";
  if (m.includes("password should be at least")) return "Le mot de passe doit contenir au moins 8 caractères.";
  // Délai minimal entre deux emails (ex. « …only request this after 59 seconds. »).
  if (m.includes("for security purposes")) {
    const seconds = m.match(/after (\d+) second/)?.[1];
    return seconds
      ? `Pour votre sécurité, patientez ${seconds} secondes avant de réessayer.`
      : "Pour votre sécurité, patientez une minute avant de réessayer.";
  }
  if (m.includes("rate limit")) return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (m.includes("same password")) return "Le nouveau mot de passe doit être différent de l'ancien.";
  return "Une erreur est survenue. Veuillez réessayer.";
}

export async function signUp(input: { email: string; password: string; firstName: string }) {
  return supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${window.location.origin}/login`,
      data: { first_name: input.firstName },
    },
  });
}

export async function signIn(input: { email: string; password: string }) {
  return supabase.auth.signInWithPassword(input);
}

export async function requestPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
}

export async function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}
