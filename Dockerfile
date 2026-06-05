FROM node:20-slim

# SQLite benötigt Build-Tools zum Kompilieren der C++ Bindings
RUN apt-get update && apt-get install -y python3 build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8787

CMD ["npm", "run", "dev"]