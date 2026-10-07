# Time Manager

Monorepo : `backend/` (NestJS + Prisma, port 3000) et `frontend/` (Vite, port 5173).
Base de données et authentification : [Neon](https://console.neon.tech/app/projects/small-moon-01415420/branches/br-orange-brook-b1mtti52) (hébergées, aucun conteneur de DB local).

## Prérequis

- Docker + Docker Compose v2
- Un projet Neon (URLs de connexion + Neon Auth)

## Lancer le projet

```bash
cp .env.example .env     # puis remplir les valeurs
docker compose up --build
```

| Service  | URL                   |
| -------- | --------------------- |
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:3000 |

Le code est monté en volume : les modifications sont rechargées à chaud (hot reload), sans rebuild.

## Variables d'environnement (`.env`)

| Variable              | Rôle                                      |
| --------------------- | ----------------------------------------- |
| `DATABASE_URL`        | URL Neon poolée (utilisée par l'app)      |
| `DATABASE_URL_DIRECT` | URL Neon directe (migrations)             |
| `NEON_AUTH_URL`       | URL Neon Auth (aussi passée au frontend)  |
| `NEON_AUTH_JWKS_URL`  | JWKS Neon Auth (vérification des tokens)  |

`.env` n'est jamais commité : ne modifier que `.env.example` pour documenter une nouvelle variable.

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

## Build de production

Les Dockerfiles ont une cible `prod` (non utilisée par `docker-compose.yml`) :

```bash
docker build --target prod -t time-manager-backend ./backend
docker build --target prod -t time-manager-frontend ./frontend   # nginx, proxy /api/ vers le backend
```
