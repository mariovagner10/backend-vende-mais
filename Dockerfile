# Dockerfile para o consumidor RabbitMQ
FROM denoland/deno:1.45.5


# Diretório de trabalho
WORKDIR /app

# Copia apenas as dependências primeiro para aproveitar o cache do Docker
COPY deps.ts .

# Faz cache das dependências do Deno
RUN deno cache deps.ts

# Copia todo o restante do código
COPY . .

# Expor variáveis de ambiente do .env (opcional, depende do seu setup)
# ENV RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/

# Comando padrão para rodar o consumidor
CMD ["run", "--allow-net", "--allow-env", "bot-consumer.ts"]
