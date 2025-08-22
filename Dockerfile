# Dockerfile
FROM denoland/deno:1.36.3

WORKDIR /app
COPY . .

# Permitir acesso a rede e variáveis
ENV DENO_ENV=production

# Rodar script consumidor
CMD ["run", "--allow-net", "--allow-env", "bot-consumer.ts"]
