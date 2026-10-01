// Détection de numéro de téléphone — SERVEUR UNIQUEMENT (importé dynamiquement).
// La fonction de la base `contains_phone_number` est réservée au serveur (phase 6) :
// elle est appelée ici avec le rôle service, jamais par le navigateur.

/** Vrai si le texte contient un numéro de téléphone (mêmes règles que les messages). */
export async function containsPhoneNumber(text: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("contains_phone_number", { _text: text });
  if (error) throw error;
  return data === true;
}
