# Use a imagem oficial do Deno como base
FROM denoland/deno:1.44.0

# Define o diretório de trabalho para a aplicação
WORKDIR /app

# Copia todos os arquivos da pasta local para o diretório de trabalho do container
# O "ponto" no final indica para copiar o conteúdo do diretório atual.
COPY . .

# Comando para executar a aplicação, garantindo todas as permissões necessárias
# Colocamos o caminho do arquivo completo a partir do WORKDIR.
CMD ["deno", "run", "--allow-net", "--allow-env", "--check", "/app/consumer.ts"]
