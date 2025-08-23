import { connect } from "./deps.ts";

async function startConsumer() {
  const rabbitUrl = Deno.env.get("RABBITMQ_URL") || "localhost";
  const username = Deno.env.get("RABBITMQ_USERNAME") || "guest";
  const password = Deno.env.get("RABBITMQ_PASSWORD") || "guest";

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
