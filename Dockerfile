# Imagem base oficial do Deno
FROM denoland/deno:1.46.3

# Definir diretório de trabalho
WORKDIR /app

# Copiar apenas arquivos de dependência primeiro
COPY deps.ts ./
COPY deno.json ./

# Fazer cache das dependências do Deno
RUN deno cache --reload deps.ts || true

# Copiar o restante do código
COPY . .

# Expor porta do serviço
EXPOSE 8081

# Comando padrão
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "bot-consumer.ts"]
