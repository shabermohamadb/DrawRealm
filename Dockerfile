FROM node:22-bookworm-slim

WORKDIR /app

# Install dependencies first for Docker layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source files
COPY . .

# Set production environment defaults
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Run DrawRealm server
CMD ["node", "server/server.js"]
