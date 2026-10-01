# Phase 12 — Étapes 12.2 à 12.6 — Demandes de contact : réponse, quota et Premium

Date : 2026-09-30 · Statut : **VALIDÉES**

## Réalisation

Migration `20260930100000_phase12_repondre_quota_demandes.sql` (drizzle `0071`) :

- **12.2 — Enregistrer la demande** (cycle de vie complet, tout côté serveur) :
  - `respond_contact_request(_request_id, _accept)` : seul le destinataire répond.
    Accepter crée le Match (même verrou que le Like réciproque, pas de doublon), la
    conversation est créée par le déclencheur existant ; les demandes croisées entre les
    deux membres sont acceptées en même temps. Refuser clôt la demande.
  - `cancel_contact_request(_request_id)` : seul l'expéditeur annule une demande en attente.
  - `list_contact_requests(_direction)` : demandes reçues ou envoyées avec prénom, âge,
    ville ; les membres masqués, suspendus ou bloqués n'apparaissent pas.
  - Après un refus, pas de relance de la même personne pendant 30 jours
    (`recently_declined`), par respect du choix du destinataire.
- **12.3 — Limite gratuite** : 5 demandes par jour calendaire UTC. Une demande compte dès
  l'envoi (même annulée ou refusée ensuite, sinon on pourrait contourner la limite) ;
  « déjà en attente » ne compte pas. Refus : `daily_limit_reached`.
- **12.4 — Quota restant** : `get_contact_request_quota()` (utilisées, limite, restantes,
  remise à zéro à minuit UTC). Affiché dans la fenêtre d'envoi et sur la page Demandes.
- **12.5 — Premium** : aucune limite si `is_premium` ; la limite revient à l'expiration.
- **12.6 — Protection serveur** : comptage dans la fonction serveur, sous un verrou par
  membre (des envois simultanés ne dépassent jamais 5) ; aucune écriture directe.

Application :
- `src/features/contacts/requests.ts` : quota, liste, réponse, annulation, messages d'erreur.
- `src/features/profiles/primary-photos.ts` (nouveau, réutilisable) : photos principales.
- `src/components/ContactRequestButton.tsx` : quota du jour dans la fenêtre, envoi
  désactivé quand il est épuisé.
- `src/routes/_authenticated/demandes.tsx` (nouveau) : onglets Reçues / Envoyées, boutons
  Accepter / Refuser / Annuler ; accepter ouvre directement la conversation.
- `src/routes/_authenticated/matches.tsx` : lien « Demandes de contact ».
- `src/integrations/supabase/types.ts` : nouvelles fonctions.

## Tests (`etape-12.2-a-12.6-demandes.mjs`) — 39/39

| Test | Résultat |
|---|---|
| Réponse : tiers et expéditeur refusés, acceptation (Match + conversation), double réponse, refus, relance après refus, annulation, demandes croisées | ✅ ×11 |
| Listes reçues / envoyées, direction invalide, membre bloquant masqué, visiteur | ✅ ×5 |
| Quota : décompte, « already_pending » gratuit, 5e acceptée, 6e refusée, remise à zéro UTC, lendemain | ✅ ×6 |
| 7 envois simultanés → 5 au plus ; écritures directes refusées | ✅ ×3 |
| Premium illimité ; retour de la limite à l'expiration | ✅ ×3 |
| Pages : lien, carte reçue, quota affiché, accepter → conversation, annuler, quota épuisé, 320 px, aucune erreur JS, nettoyage | ✅ ×11 |

## Non-régression

12.1 : 30/30 · 3.5 : 14/14 · 3.6 : 17/17. Type-check : 0 erreur · Build : réussi.
