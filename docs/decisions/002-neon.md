# 002 · Neon pour la base de données et l'authentification

**Statut :** adoptée, connexion Microsoft à confirmer

## Contexte

L'application a besoin d'une base PostgreSQL fiable, de sauvegardes et d'une authentification par email / mot de passe et compte Microsoft. Le client est soumis au RGPD.

## Décision

- Base PostgreSQL hébergée sur Neon.
- Authentification email / mot de passe déléguée à Neon Auth. Le backend vérifie les tokens avec la clé publique (JWKS).

## Raisons

- Pas de serveur de base à administrer : sauvegardes et restauration à un instant donné incluses.
- Branches de base : tester une migration sur une copie des données avant la production.
- Neon Auth évite de coder et sécuriser nous-mêmes le stockage des mots de passe et les sessions.

## Alternatives écartées

- Conteneur PostgreSQL en production : sauvegardes et mises à jour à notre charge.
- Authentification maison (JWT + argon2) : plus de code sensible à écrire et à tester.

## Point ouvert : connexion Microsoft

Le sujet impose la connexion avec un compte Microsoft. Le guide OAuth de la version actuelle de Neon Auth (Better Auth) ne liste que Google, GitHub et Vercel. Microsoft n'apparaît que dans la documentation de l'ancienne version (Stack Auth).

- Si le tableau de bord Neon propose Microsoft : le configurer avec le Tenant ID de l'entreprise.
- Sinon : gérer la connexion Microsoft (OIDC avec Microsoft Entra ID) dans le backend, en liant le compte Microsoft à l'utilisateur existant par son email.

## Conséquences

- Deux URL de connexion : poolée pour l'application, directe pour les migrations.
- Neon suspend la base après inactivité : la première requête suivante est plus lente.
- Le projet Neon doit être en région Union européenne (RGPD).
- Les tests ont besoin d'une base : branche Neon dédiée ou conteneur PostgreSQL en CI.
