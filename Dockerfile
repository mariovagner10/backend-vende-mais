# Dockerfile para consumidor RabbitMQ moderno
FROM denoland/deno:1.44.0

WORKDIR /app

COPY deps.ts .
RUN deno cache deps.ts

COPY . .

# Executa o consumidor com permissão de rede e variáveis de ambiente
CMD ["run", "--allow-net", "--allow-env", "consumer.ts"]
