FROM denoland/deno:1.36.0

WORKDIR /app

COPY bot-consumer.ts ./

CMD ["run", "--allow-net", "--allow-env", "bot-consumer.ts"]
