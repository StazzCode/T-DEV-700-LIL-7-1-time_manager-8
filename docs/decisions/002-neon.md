# 002 · Neon pour la base de données et l'authentification

**Statut :** adoptée

## Contexte

L'application a besoin d'une base PostgreSQL fiable, de sauvegardes et d'une authentification par email / mot de passe et compte Microsoft. Le client est soumis au RGPD.

## Décision

- Base PostgreSQL hébergée sur Neon.
- Authentification déléguée à Neon Auth. Le backend vérifie les tokens avec la clé publique (JWKS).

## Raisons

- Pas de serveur de base à administrer : sauvegardes et restauration à un instant donné incluses.
- Branches de base : tester une migration sur une copie des données avant la production.
- Neon Auth évite de coder et sécuriser nous-mêmes le stockage des mots de passe et les sessions.

## Alternatives écartées

- Conteneur PostgreSQL en production : sauvegardes et mises à jour à notre charge.
- Authentification maison (JWT + argon2) : plus de code sensible à écrire et à tester.

## Conséquences

- Deux URL de connexion : poolée pour l'application, directe pour les migrations.
- Neon suspend la base après inactivité : la première requête suivante est plus lente.
- Le projet Neon doit être en région Union européenne (RGPD).
- Les tests ont besoin d'une base : branche Neon dédiée ou conteneur PostgreSQL en CI.
