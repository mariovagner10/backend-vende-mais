# Imagem base com Deno
FROM denoland/deno:1.38.3

# Diretório de trabalho dentro do container
WORKDIR /app

# Copiar arquivos do projeto
COPY . .

# Dar permissão ao Deno para rodar com acesso a rede, variáveis e arquivos
# Também vamos permitir que o container execute scripts Deno
ENV DENO_DIR=/deno-dir

# Instalar dependências (cache)
RUN deno cache bot-consumer.ts

# Expor a porta definida no .env
ARG PORT=8081
EXPOSE ${PORT}

# Comando para rodar o bot consumidor
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "--unstable", "bot-consumer.ts"]
