import { connect } from "jsr:@nashaddams/amqp";

async function startConsumer() {
  const hostname = Deno.env.get("RABBITMQ_HOST") || "127.0.0.1";
  const username = Deno.env.get("RABBITMQ_USERNAME") || "admin";
  const password = Deno.env.get("RABBITMQ_PASSWORD") || "admin123";

  while (true) {
    try {
      console.log("🟡 Tentando conectar ao RabbitMQ...");
      const connection = await connect({ hostname, username, password });
      const channel = await connection.openChannel();

      console.log("🟢 Conectado ao RabbitMQ, listando filas...");

      // Listar todas as filas que começam com "whatsapp_"
      const queuesResp = await channel.rpc({ method: "queue.list" }).catch(() => []);
      const queues: string[] = (queuesResp || []).filter((q: string) => q.startsWith("whatsapp_"));

      if (!queues.length) {
        console.log("⚠️ Nenhuma fila whatsapp_* encontrada. Aguardando novas filas...");
      }

      for (const queueName of queues) {
        console.log("📥 Consumindo fila:", queueName);

        channel.consume({ queue: queueName, noAck: false }, async (message) => {
          if (!message) return;

          const raw = new TextDecoder().decode(message.body);
          let payload: any;
          try {
            payload = JSON.parse(raw);
          } catch (err) {
            console.warn(`⚠️ Mensagem inválida (não JSON) na fila ${queueName}:`, raw);
            channel.nack({ deliveryTag: message.deliveryTag, requeue: false });
            return;
          }

          try {
            console.log("📩 Mensagem recebida da fila:", payload);
            await processIncomingMessage(payload);
            channel.ack({ deliveryTag: message.deliveryTag });
          } catch (err) {
            console.error("❌ Erro processando mensagem:", err);
            channel.nack({ deliveryTag: message.deliveryTag, requeue: true });
          }
        });
      }

      // Mantém o consumer ativo
      await new Promise(() => {});
    } catch (error) {
      console.error("❌ Erro de conexão com RabbitMQ:", error.message);
      console.log("🔄 Tentando reconectar em 5 segundos...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

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

startConsumer();
