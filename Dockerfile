# Use a imagem oficial do Deno como base
FROM denoland/deno:1.44.0

# Define o diretório de trabalho para a aplicação
WORKDIR /app

# Copia apenas o arquivo de dependências primeiro para aproveitar o cache do Docker
# Se deps.ts não mudar, esta camada não será reconstruída
COPY deps.ts .

# Baixa e armazena em cache as dependências, permitindo acesso à rede
# ESTE É O PASSO CORRIGIDO!
RUN deno cache --allow-net deps.ts

# Copia o restante da aplicação
COPY consumer.ts .

# Comando para executar a aplicação
# Garante as permissões de rede e variáveis de ambiente
CMD ["run", "--allow-net", "--allow-env", "consumer.ts"]
