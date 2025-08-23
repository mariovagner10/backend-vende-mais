import { connect } from "jsr:@nashaddams/amqp";

async function startConsumer() {
  const rabbitUrl = Deno.env.get("RABBITMQ_URL") || "rabbitmq";
  const username = Deno.env.get("RABBITMQ_USERNAME") || "admin";
  const password = Deno.env.get("RABBITMQ_PASSWORD") || "admin123";

  // Loop para tentar reconectar em caso de falha.
  while (true) {
    try {
      console.log("🟡 Tentando conectar ao RabbitMQ...");
      // A biblioteca amqp usa `hostname` e não a URL completa
      const connection = await connect({ hostname: rabbitUrl, username, password });
      const channel = await connection.openChannel();

      const queueName = "whatsapp_messages";
      await channel.declareQueue({ queue: queueName, durable: true });

      console.log("🟢 Bot consumidor conectado na fila:", queueName);

      for await (const message of channel.consume({ queue: queueName, noAck: false })) {
        try {
          const payload = JSON.parse(new TextDecoder().decode(message.body));
          console.log("📩 Mensagem recebida da fila:", payload);

          await processIncomingMessage(payload);

          channel.ack({ deliveryTag: message.deliveryTag });
        } catch (error) {
          console.error("❌ Erro processando mensagem da fila:", error);
          channel.nack({ deliveryTag: message.deliveryTag, requeue: true });
        }
      }

    } catch (error) {
      console.error("❌ Erro de conexão com o RabbitMQ:", error.message);
      console.log("🔄 Tentando reconectar em 5 segundos...");
      // Espera 5 segundos antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function processIncomingMessage(message: any) {
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
}

startConsumer();
