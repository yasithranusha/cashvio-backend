FROM node:22-alpine AS base

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY yarn.lock ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Development stage
FROM base AS development
RUN yarn install
COPY . .
CMD ["yarn", "start:dev", "mailer"]

# Build stage
FROM development AS build
RUN yarn build mailer

# Production stage
FROM node:22-alpine AS production
WORKDIR /usr/src/app

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

COPY --from=base package*.json ./
COPY --from=base yarn.lock ./

# Install production dependencies only
RUN yarn install --production

# Copy built application from build stage
COPY --from=build /usr/src/app/dist/apps/mailer ./dist

# Command to run the application
CMD ["node", "dist/main.js"]