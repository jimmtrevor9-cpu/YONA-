# Phases 16, 17 et 18 — Ice Breaker, Message Flash, compatibilité

Test : `etapes-16-17-18-icebreaker-flash-compatibilite.mjs` — **21/21** (base Supabase locale,
application construite, IA simulée `AI_PROVIDER=test`).

- **16 Ice Breaker** : idées de premier message pour tous ; idée personnalisée par l'IA pour
  les Premium seulement (vérifié côté serveur), comptée dans le quota IA, contrôle des numéros.
- **17 Message Flash** : demande de contact mise en avant, réservée au Premium, message
  obligatoire, affichée en tête des demandes reçues.
- **18 Compatibilité** : score sur 100 calculé par des règles en SQL (pas d'IA) ; même score
  dans les deux sens ; détail réservé au Premium ; aucun score pour un profil bloqué ou invisible.

Non testé en réel : la vraie clé Anthropic (réponse IA simulée).
