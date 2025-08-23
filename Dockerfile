# Use a imagem oficial do Deno como base
FROM denoland/deno:1.44.0

# Define o diretório de trabalho para a aplicação
WORKDIR /app

# Copia todos os arquivos da pasta local para o diretório de trabalho do container
COPY . .

# Comando para executar a aplicação
# Garante as permissões de rede e variáveis de ambiente.
# A primeira execução de `deno run` vai baixar e cachear as dependências
# A flag '--check' vai fazer o check de tipos, que é uma boa prática
CMD ["run", "--allow-net", "--allow-env", "--check", "./consumer.ts"]
