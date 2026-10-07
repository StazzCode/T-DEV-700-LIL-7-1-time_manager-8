# 003 · Caddy comme serveur web et reverse proxy

**Statut :** adoptée, remplace nginx

## Contexte

En production, il faut servir le build React, rediriger `/api` vers le backend et exposer l'application en HTTPS.

## Décision

L'image de production du frontend embarque Caddy (`frontend/Caddyfile`).

## Raisons

- HTTPS automatique (Let's Encrypt) dès qu'on renseigne un nom de domaine.
- Configuration en quelques lignes, plus courte que l'équivalent nginx + certbot.
- Front et API sur la même origine : pas de CORS.

## Alternative écartée

nginx : plus répandu, mais certificats et renouvellement à gérer à part.

## Conséquences

Le reverse proxy fait partie de l'image frontend. Si le sujet exige un service `reverse proxy` séparé dans Docker Compose, il faudra le sortir dans son propre service.
