# Phase 1 — Étape 1.6 — Vérifier la réinitialisation du mot de passe

Date : 2026-09-26 · Statut : **VALIDÉE**

Périmètre : page « Nouveau mot de passe » (`/reset-password`) ouverte depuis le lien
reçu par email (la demande du lien a été vérifiée à l'étape 1.5).

## Problèmes trouvés et corrigés

| # | Problème | Correction |
|---|---|---|
| 1 | Ancien mot de passe réutilisé : Supabase répond « New password should be different from the old password. » → YONA affichait « Une erreur est survenue. » | `translateAuthError` reconnaît ce message → « Le nouveau mot de passe doit être différent de l'ancien. » |
| 2 | Lien expiré ou déjà utilisé : la page disait « Ouvrez cette page depuis le lien reçu par email. » (on venait du lien) puis « Une erreur est survenue. » | La page lit `#error=…` renvoyé par Supabase → « Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau depuis « Mot de passe oublié ? ». » |
| 3 | Page ouverte sans lien : « Une erreur est survenue. » à l'enregistrement | Envoi bloqué avant l'appel au serveur → « Ce lien n'est plus valable. Demandez un nouveau lien depuis « Mot de passe oublié ? ». » (+ même traduction pour « Auth session missing ») |

Fichiers : `src/routes/reset-password.tsx` (logique et sous-titre uniquement, mise en
page inchangée), `src/features/auth/auth.service.ts`.

## Tests (`etape-1.6-nouveau-mot-de-passe.mjs`, Chromium, vrais liens reçus) — 17/17

| Test | Résultat |
|---|---|
| Lien → page qui reconnaît le lien | ✅ |
| Deux champs masqués, `new-password`, obligatoires, 8 caractères min. | ✅ |
| Confirmation différente → « Les deux mots de passe ne correspondent pas. » | ✅ |
| 7 caractères → « …au moins 8 caractères. » | ✅ |
| Ancien mot de passe → « …différent de l'ancien. » | ✅ (échouait avant) |
| « Mise à jour… » désactivé ; double clic → 1 requête | ✅ |
| Succès → « Mot de passe mis à jour. » et `/discover` ; nouveau accepté, ancien refusé | ✅ |
| Lien déjà utilisé → page explicite + envoi refusé avec message clair | ✅ (échouait avant) |
| Accès direct sans lien → page explicite + envoi refusé + mot de passe inchangé | ✅ (message générique avant) |
| 320 px, lien « Retour à la connexion », aucune erreur JavaScript | ✅ |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16. (Un compte laissé par un premier essai interrompu de ce
test avait faussé deux comptages ; le test nettoie désormais les restes au démarrage.)

## À savoir (réglages Supabase, non modifiés)

- Un membre déjà connecté qui ouvre `/reset-password` peut changer son mot de passe
  sans saisir l'ancien (comportement standard de Supabase). Option du tableau de
  bord « Secure password change » pour exiger une connexion récente.
- Les autres appareils déjà connectés ne sont pas déconnectés après le changement.
- Règle de mot de passe : 8 caractères minimum, sans autre exigence.
