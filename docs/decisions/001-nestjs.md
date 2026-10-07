# 001 · NestJS pour le backend

**Statut :** adoptée

## Contexte

Le backend porte toute la logique métier et doit exposer une API REST sécurisée par rôle. Deux développeurs y travaillent en parallèle.

## Décision

NestJS sur Node.js 24, en TypeScript strict, avec Vitest pour les tests.

## Raisons

- Un module par domaine (users, teams, time-entries, reports) : les deux devs backend travaillent sans se gêner.
- Les guards gèrent l'authentification et les rôles une seule fois, pour toutes les routes.
- Validation des entrées et documentation Swagger générées depuis le code.
- Module de test intégré pour les tests e2e des routes.

## Alternative écartée

Express : plus léger, mais structure, validation, guards et Swagger seraient à assembler à la main.

## Conséquences

- Courbe d'apprentissage (décorateurs, injection de dépendances).
- La logique de calcul reste en fonctions pures, hors de NestJS, pour être testée sans framework.
