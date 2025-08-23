# Use a imagem oficial do Deno como base
FROM denoland/deno:1.44.0

# Define o diretório de trabalho para a aplicação
WORKDIR /app

# Copia todos os arquivos da pasta local para o diretório de trabalho do container
COPY . .

# Comando para executar a aplicação
# A primeira execução de `deno run` vai baixar e cachear as dependências
# As flags --allow-net e --allow-env são necessárias para a aplicação
CMD ["deno", "run", "--allow-net", "--allow-env", "./consumer.ts"]
