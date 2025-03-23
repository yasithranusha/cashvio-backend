FROM node:22-alpine AS base

WORKDIR /usr/src/app

# Copy package files from root context
COPY ./package*.json ./
COPY ./yarn.lock ./
COPY ./tsconfig*.json ./
COPY ./nest-cli.json ./
COPY ./prisma ./prisma/

# Development stage
FROM base AS development
RUN yarn install
COPY . .
RUN yarn prisma generate
CMD ["yarn", "start:dev", "auth"] 

# Build stage
FROM development AS build
RUN yarn build auth 

# Production stage
FROM node:22-alpine AS production
WORKDIR /usr/src/app

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

COPY --from=base /usr/src/app/package*.json ./
COPY --from=base /usr/src/app/yarn.lock ./
COPY --from=base /usr/src/app/prisma ./prisma/

# Install production dependencies only
RUN yarn install --production && \
    yarn prisma generate

# Copy built application from build stage
COPY --from=build /usr/src/app/dist/apps/auth ./dist 

# Command to run the application
CMD ["node", "dist/main.js"]