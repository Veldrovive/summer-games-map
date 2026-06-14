FROM node:20-alpine

# Set to production environment
ENV NODE_ENV=production

# Use the non-root node user provided by the image
USER node

# Create app directory with proper permissions
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY --chown=node:node package*.json ./

# Use ci for deterministic, clean installs
RUN npm ci --only=production

# Copy application source
COPY --chown=node:node . .

EXPOSE 3001

CMD ["node", "server.js"]
