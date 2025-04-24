# Stage 1: Build the frontend
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the Vue app
RUN npm run build
# The build output is now in /app/dist

# Stage 2: Setup the production environment
FROM node:20-alpine
WORKDIR /app

# Copy package files and install *only* production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the built frontend assets from the builder stage
COPY --from=builder /app/dist ./dist

# Copy the backend server code
COPY server.js .

# Copy the .env file (See note below about production best practices)
COPY .env .

# Expose the port the server will listen on
EXPOSE 3000

# Command to run the backend server
CMD ["node", "server.js"]
