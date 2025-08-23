import { connect } from "jsr:@nashaddams/amqp";

// Função para processar mensagens
async function processIncomingMessage(message: any) {
  try {
    const req = new Request(
      "https://gythzfdqhubzzisordgq.supabase.co/functions/v1/bot-hybrid",
      {
        method: "POST",
        body: JSON.stringify(message),
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await fetch(req);
    if (!res.ok) console.error("Erro no endpoint de processamento:", await res.text());
  } catch (err) {
    console.error("❌ Erro no fetch:", err);
  }
}

// Função para consumir mensagens de uma fila específica
async function consumeQueue(channel: any, queueName: string) {
  await channel.declareQueue({ queue: queueName, durable: true });
  console.log("🟢 Consumidor conectado na fila:", queueName);

  channel.consume({ queue: queueName, noAck: false }, async (message) => {
    if (!message || !message.body || message.body.length === 0) {
      console.warn(`[${queueName}] Mensagem vazia, ignorando`);
      if (message) channel.ack({ deliveryTag: message.deliveryTag });
      return;
    }

    const rawText = new TextDecoder().decode(message.body);
    let payload: any;

    try {
      payload = JSON.parse(rawText);
    } catch (err) {
      console.error(`[${queueName}] JSON inválido:`, rawText, err);
      channel.nack({ deliveryTag: message.deliveryTag, requeue: false });
      return;
    }

    try {
      console.log(`[${queueName}] Mensagem recebida:`, payload);
      await processIncomingMessage(payload);
      channel.ack({ deliveryTag: message.deliveryTag });
    } catch (err) {
      console.error(`[${queueName}] Erro processando mensagem:`, err);
      channel.nack({ deliveryTag: message.deliveryTag, requeue: true });
    }
  });
}

// Função principal para conectar e consumir todas filas `whatsapp_*`
async function startConsumer() {
  const hostname = Deno.env.get("RABBITMQ_HOST") || "rabbitmq";
  const username = Deno.env.get("RABBITMQ_USERNAME") || "admin";
  const password = Deno.env.get("RABBITMQ_PASSWORD") || "admin123";

  while (true) {
    try {
      console.log("🟡 Tentando conectar ao RabbitMQ...");
      const connection = await connect({ hostname, username, password });
      const channel = await connection.openChannel();

      console.log("🟢 Conectado ao RabbitMQ, listando filas...");

      // Lista todas filas existentes
      const queuesResponse = await fetch(`http://${hostname}:15672/api/queues`, {
        headers: {
          Authorization: `Basic ${btoa(`${username}:${password}`)}`,
          "Content-Type": "application/json",
        },
      });

      const allQueues = await queuesResponse.json();
      const whatsappQueues = allQueues
        .map((q: any) => q.name)
        .filter((name: string) => name.startsWith("whatsapp_"));

      if (whatsappQueues.length === 0) {
        console.log("⚠️ Nenhuma fila whatsapp_* encontrada. Aguardando novas filas...");
      }

      // Consumir todas filas whatsapp_*
      for (const queueName of whatsappQueues) {
        consumeQueue(channel, queueName);
      }

      // Fica ativo mantendo a conexão
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }

    } catch (error) {
      console.error("❌ Erro de conexão com o RabbitMQ:", error.message || error);
      console.log("🔄 Tentando reconectar em 5 segundos...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

startConsumer();
