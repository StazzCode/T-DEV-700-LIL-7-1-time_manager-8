# 002 · Neon pour la base de données et l'authentification

**Statut :** adoptée pour la base et la connexion email / mot de passe. Connexion Microsoft à trancher par Youssef avant le sprint 3.

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

Le sujet impose la connexion Microsoft ; le guide OAuth actuel de Neon Auth ne liste que Google, GitHub et Vercel.

1. Vérifier dans le tableau de bord Neon si Microsoft est proposé. Si oui, le configurer avec le Tenant ID de l'entreprise : la décision reste valable.
2. Sinon, cette décision est à revoir pour l'authentification. Gérer Microsoft dans le backend implique d'émettre nos propres tokens, ce que la décision voulait justement éviter. Comparer alors avec Better Auth hébergé dans le backend, qui gère email / mot de passe et Microsoft.

Quelle que soit l'option, un compte Microsoft se lie à un utilisateur par les claims `oid` et `tid`, jamais par l'email seul : l'email d'un compte Entra ID peut être modifié par son titulaire. Seuls les comptes du tenant de l'entreprise sont acceptés. Sans utilisateur correspondant, la connexion est refusée : les comptes sont créés par les managers.

## Conséquences

- Deux URL de connexion : poolée pour l'application, directe pour les migrations.
- Neon suspend la base après inactivité : la première requête suivante est plus lente.
- Le projet Neon doit être en région Union européenne (RGPD).
- Les tests ont besoin d'une base : branche Neon dédiée ou conteneur PostgreSQL en CI.
