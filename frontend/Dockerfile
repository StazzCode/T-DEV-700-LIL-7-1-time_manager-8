FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS dev
RUN npm ci
COPY . .
CMD ["npm", "run", "dev", "--", "--host"]

FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
