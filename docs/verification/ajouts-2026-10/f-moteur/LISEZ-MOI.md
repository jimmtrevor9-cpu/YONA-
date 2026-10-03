# Essai du moteur de visages (tâche F)

Ce test fait tourner le **vrai** moteur de vérification d'identité (`@vladmandic/face-api`,
WebAssembly, code serveur du site) sur des images de test :

- des portraits **générés par IA** (profils de démonstration, aucune personne réelle),
  convertis en JPEG avec une variante (autre photo de la même « personne ») et une rotation de
  tête simulée (`/var/tmp/yona-e2e/make-faces.mjs`, `make-turn.mjs`) ;
- une fausse carte « spécimen » fabriquée avec un de ces portraits (`make-card.mjs`).

```sh
npx vite build --config docs/verification/ajouts-2026-10/f-moteur/vite.config.mjs
node node_modules/.cache/yona-essai-moteur/essai-moteur.js
```

Résultat obtenu le 3 octobre 2026 :

| Cas | Décision |
|---|---|
| Même personne (selfie ↔ photo de profil) | ressemblance 0,78 → vérifiée |
| Autre personne | ressemblance 0,23 → refusée (`mismatch`) |
| Tête tournée du mauvais côté | refusée (`wrong_direction`) |
| Tête non tournée | refusée (`liveness_failed`) |
| Selfie + bonne pièce | pièce 0,84 → vérifiée |
| Selfie + pièce d'une autre personne | pièce 0,21 → refusée |
| Pièce seule | 0,75 → vérifiée |
| Selfie sans visage | refusée (`no_face`) |

Temps : environ 1 s pour charger le moteur, puis 0,4 à 0,8 s par image.
La rotation de tête simulée étant faible, le seuil de rotation est abaissé à 0,03 pour
l'essai (0,08 par défaut, réglable dans l'administration).
