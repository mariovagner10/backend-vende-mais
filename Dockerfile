# --- STAGE 1: Build Stage ---
# Usamos uma imagem mais completa do Deno para o processo de build e cache
FROM denoland/deno:1.44.0 as build-stage

# Define o diretório de trabalho
WORKDIR /app

# Copia todos os arquivos da pasta local para o diretório de trabalho do container
COPY . .

# Comando para baixar e armazenar em cache as dependências.
# Não precisamos da flag --allow-net para este comando.
RUN deno cache /app/bot-consumer.ts

# --- STAGE 2: Run Stage ---
# Usamos uma imagem "slim" para o runtime para uma imagem final menor
FROM denoland/deno:1.44.0

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos cacheados e a aplicação do estágio de build para o estágio de execução
COPY --from=build-stage /deno-dir /deno-dir
COPY --from=build-stage /app /app

# Comando para executar a aplicação
# As flags --allow-net e --allow-env são necessárias para a aplicação
CMD ["deno", "run", "--allow-net", "--allow-env", "/app/bot-consumer.ts"]
