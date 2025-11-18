# Usar imagen oficial de Node.js 20
FROM node:20-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar el resto de la aplicación
COPY . .

# Exponer puerto
EXPOSE 10000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=10000

# Comando de inicio
CMD ["npm", "start"]
