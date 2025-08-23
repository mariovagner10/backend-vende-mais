# Use a imagem oficial do Deno como base
FROM denoland/deno:1.44.0

# Define o diretório de trabalho para a aplicação
WORKDIR /app

# Copia todos os arquivos da pasta local para o diretório de trabalho do container
COPY . .

# Baixa e armazena em cache as dependências, permitindo acesso à rede.
# A flag --allow-net é necessária para baixar módulos da internet.
RUN deno cache deps.ts --allow-net

# Comando para executar a aplicação
# Garante as permissões de rede e variáveis de ambiente
CMD ["run", "--allow-net", "--allow-env", "consumer.ts"]
