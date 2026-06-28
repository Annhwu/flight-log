# Stage 1 : Build
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 : Serve
FROM nginx:alpine AS runner

RUN printf 'server {\n    listen       80;\n    server_name  _;\n    root         /usr/share/nginx/html;\n    index        index.html;\n    gzip on;\n    gzip_types text/plain text/css application/javascript application/json;\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {\n        expires 1y;\n        add_header Cache-Control "public, immutable";\n    }\n}\n' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
