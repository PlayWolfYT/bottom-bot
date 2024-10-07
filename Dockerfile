# Use the official Bun image
FROM oven/bun:latest

# Set working directory
WORKDIR /app

# Copy package files
COPY bun.lockb package.json tsconfig.json ./

# Install dependencies, including Prisma CLI
RUN bun install

# Install OpenSSL
RUN apt-get update -y && apt-get install -y openssl

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN bunx prisma generate

# Copy source code
COPY . .

# Expose port if needed (for the dashboard)
EXPOSE 8080

# Start the bot
CMD ["bun", "run", "start"]
