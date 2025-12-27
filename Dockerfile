FROM node:20-alpine
WORKDIR /app

# Install timezone data for India timezone support
RUN apk add --no-cache tzdata

# Copy root package files
COPY package.json package-lock.json ./

# Copy client package files
COPY client/package.json client/package-lock.json ./client/

# Install root dependencies
RUN npm install

# Install client dependencies
RUN cd client && npm install

# Copy all remaining files
COPY . .

# Build the client
RUN npm run build

# Expose the port (adjust if needed)
EXPOSE 3001

# Start the server
CMD ["npm", "start"]