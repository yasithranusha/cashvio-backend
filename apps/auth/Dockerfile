FROM node:alpine AS development
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
COPY yarn.lock ./
RUN yarn install

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN yarn prisma generate

# Copy source code
COPY . .

RUN yarn build auth

CMD ["yarn", "start:dev"]

FROM node:alpine AS production
WORKDIR /usr/src/app

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Copy package files
COPY package*.json ./
COPY yarn.lock ./
COPY prisma ./prisma/

# Install production dependencies
RUN yarn install --production

# Generate Prisma client for production
RUN yarn prisma generate

# Copy built files from development stage
COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/apps/auth/main"]