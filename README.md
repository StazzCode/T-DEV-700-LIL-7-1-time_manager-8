# Time Manager

Monorepo : `backend/` (NestJS + Prisma, port 3000) et `frontend/` (Vite, port 5173).
Base de données : [Neon](https://console.neon.tech/app/projects/small-moon-01415420/branches/br-orange-brook-b1mtti52) (hébergées, aucun conteneur de DB local).

## Prérequis

- Docker + Docker Compose v2
- Un projet Neon (URLs de connexion)

## Lancer le projet

```bash
cp backend/.env.example backend/.env   # puis remplir les valeurs (voir ci-dessous)
docker compose up --build
```

| Service  | URL                   |
| -------- | --------------------- |
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:3000 |

Le code est monté en volume : les modifications sont rechargées à chaud (hot reload), sans rebuild.

## Variables d'environnement (`backend/.env`)

| Variable              | Rôle                                                     |
| --------------------- | -------------------------------------------------------- |
| `DATABASE_URL`        | URL Neon poolée (utilisée par l'app), via `neon env pull` |
| `BETTER_AUTH_SECRET`  | Signe les cookies de session (voir Secrets)              |
| `BETTER_AUTH_URL`     | Origine utilisée par le navigateur : `http://localhost:5173` en dev |

`.env` n'est jamais commité : ne modifier que `.env.example` pour documenter une nouvelle variable.

### Secrets

- **En développement**, chacun génère son propre secret : `openssl rand -base64 32`, à coller dans `BETTER_AUTH_SECRET`. Ne pas le partager, même si plusieurs personnes utilisent la même branche Neon : les sessions sont en base et chaque cookie n'est vérifié que par le backend de son propriétaire.
- **En staging / production**, un secret unique par environnement, stocké dans les secrets de l'hébergeur (ou le futur `.env.prod`). Jamais dans Git, jamais par chat ou email, jamais réutilisé depuis le dev.
- **Changer un secret** déconnecte tous les utilisateurs de cet environnement. C'est sans risque, et c'est la marche à suivre si un secret fuite.
- Si une option Better Auth qui chiffre des données en base avec le secret est activée un jour, toutes les personnes qui partagent une même branche Neon devront utiliser le même secret.

## Commandes utiles

```bash
docker compose up -d                  # lancer en arrière-plan
docker compose logs -f backend        # suivre les logs d'un service
docker compose exec backend sh        # shell dans un conteneur
docker compose exec backend npm run seed  # données de démo (2 équipes, 22 utilisateurs, 4 semaines de pointages)
docker compose down                   # arrêter et supprimer les conteneurs

# Après un changement de package.json / package-lock.json
docker compose up --build -V          # -V : recrée le volume node_modules

# Tests / lint backend
docker compose exec backend npm test
docker compose exec backend npm run lint
```

## Dépannage

- **Port déjà utilisé** : libérer 3000 / 5173 ou modifier le mapping `ports` dans `docker-compose.yml`.
- **Module introuvable après `git pull`** : `docker compose up --build -V` (le `node_modules` du conteneur est un volume anonyme).
- **Le backend ne démarre pas** : vérifier que `.env` existe et que les URLs Neon sont valides.

## Miroir de la CI

Les crédits GitHub Actions de l'organisation sont épuisés. La CI tourne donc sur un miroir personnel : [StazzCode/T-DEV-700-LIL-7-1-time_manager-8](https://github.com/StazzCode/T-DEV-700-LIL-7-1-time_manager-8). Le dépôt de l'organisation reste la référence, le miroir ne sert qu'à exécuter la CI.

Pour qu'un `git push` mette à jour les deux dépôts, configurer `origin` une seule fois :

```bash
git remote set-url --add --push origin https://github.com/EpitechMscProPromo2028/T-DEV-700-LIL-7-1-time_manager-8.git
git remote set-url --add --push origin https://github.com/StazzCode/T-DEV-700-LIL-7-1-time_manager-8.git
git remote -v   # origin doit apparaître en fetch (org) et en push (org + miroir)
```

- Il faut un accès en écriture au miroir (à demander à StazzCode, Settings > Collaborators). Sans lui, le push vers le miroir est refusé, mais celui vers l'organisation est déjà passé.
- Les checks de la PR sur l'organisation restent en échec : lire le résultat de la CI dans l'onglet Actions du miroir.
- Un merge fait depuis l'interface GitHub de l'organisation n'est pas répercuté sur le miroir. Après un merge : `git pull`, puis `git push`.
- Le miroir est public : aucun secret dans le code ni dans l'historique.

## Build de production

Les Dockerfiles ont une cible `prod` (non utilisée par `docker-compose.yml`) :

```bash
docker build --target prod -t time-manager-backend ./backend
docker build --target prod -t time-manager-frontend ./frontend   # nginx, proxy /api/ vers le backend
```
