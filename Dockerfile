# --- STAGE 1: Build Stage ---
# Usamos uma imagem mais completa do Deno para o processo de build e cache
FROM denoland/deno:1.44.0 as build-stage

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos necessários para o cache.
# Isso garante que as dependências sejam cacheadas antes de copiar o resto do código.
COPY deps.ts .

# Baixa e armazena em cache as dependências.
# A flag --allow-net é necessária para que o Deno possa buscar os módulos.
RUN deno cache deps.ts --allow-net

# Copia todo o resto dos arquivos da aplicação
COPY . .

# --- STAGE 2: Run Stage ---
# Usamos uma imagem "slim" para o runtime para uma imagem final menor
FROM denoland/deno:1.44.0

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos cacheados e a aplicação do estágio de build para o estágio de execução
COPY --from=build-stage /deno-dir /deno-dir
COPY --from=build-stage /app /app

# Comando para executar a aplicação
# Garantimos as permissões de rede e ambiente.
CMD ["deno", "run", "--allow-net", "--allow-env", "--check", "consumer.ts"]
