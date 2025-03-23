FROM node:alpine AS development

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

CMD ["yarn", "start:dev", "mailer"]

FROM node:alpine AS production
WORKDIR /usr/src/app

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Merge copy and install commands into a single RUN
COPY package*.json yarn.lock ./
COPY prisma ./prisma/
RUN yarn install --production && \
    yarn prisma generate

# Copy built files from development stage
COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/apps/mailer/main"]