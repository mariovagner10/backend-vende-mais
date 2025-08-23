FROM denoland/deno:1.45.5

WORKDIR /app

# Copia apenas os deps primeiro (para cache de build)
COPY deps.ts .

# Faz cache das dependências (vai baixar e compilar tudo)
RUN deno cache deps.ts

# Agora copia o resto do código
COPY . .

# Roda o app
CMD ["run", "--allow-net", "--allow-env", "consumer.ts"]
