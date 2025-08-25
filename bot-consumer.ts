import { connect, Channel, Connection } from "jsr:@nashaddams/amqp";

// Configurações RabbitMQ
const RABBITMQ_HOST = Deno.env.get("RABBITMQ_HOST") || "127.0.0.1";
const RABBITMQ_USERNAME = Deno.env.get("RABBITMQ_USERNAME") || "admin";
const RABBITMQ_PASSWORD = Deno.env.get("RABBITMQ_PASSWORD") || "admin123";
const QUEUE_NAME = "whatsapp_messages";
const DLQ_NAME = "whatsapp_messages_failed";
const BOT_HYBRID_URL =
  Deno.env.get("BOT_HYBRID_FUNCTION_URL") ||
  "https://gythzfdqhubzzisordgq.supabase.co/functions/v1/bot-hybrid";
const FETCH_TIMEOUT = 15000; // 15 segundos

// A função 'processMessage' e a lógica de concorrência foram movidas para cá.

// Inicializa consumer
async function startConsumer() {
  while (true) {
    try {
      console.log("🟡 Tentando conectar ao RabbitMQ...");
      const connection: Connection = await connect({
        hostname: RABBITMQ_HOST,
        username: RABBITMQ_USERNAME,
        password: RABBITMQ_PASSWORD,
      });

      const channel: Channel = await connection.openChannel();
      console.log("🟢 Conectado ao RabbitMQ");

      await channel.declareQueue({ queue: QUEUE_NAME, durable: true });
      await channel.declareQueue({ queue: DLQ_NAME, durable: true });

      console.log("📥 Consumindo fila:", QUEUE_NAME);

      // O callback agora lida com todo o processamento
      channel.consume({ queue: QUEUE_NAME, noAck: false }, async (args, props, data) => {
        // ✅ O corpo da mensagem é a variável 'data'
        if (!data || data.length === 0) {
          console.warn("⚠️ Mensagem sem conteúdo, ignorando...");
          channel.nack({ deliveryTag: args.deliveryTag, requeue: false });
          return;
        }

        try {
          const raw = new TextDecoder().decode(data);
          const payload: any = JSON.parse(raw);
          console.log("✅ Mensagem JSON válida:", payload);

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
          const response = await fetch(BOT_HYBRID_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!response.ok) {
            throw new Error(`bot-hybrid retornou status ${response.status}`);
          }

          console.log("✅ Mensagem processada com sucesso para:", payload.phone_number);
          channel.ack({ deliveryTag: args.deliveryTag });

        } catch (err: any) {
          console.error("❌ Erro processando mensagem:", err);

          let payload: any;
          try {
            payload = JSON.parse(new TextDecoder().decode(data));
            payload.retryCount = (payload.retryCount || 0) + 1;
          } catch {
            payload = {
              retryCount: 1,
              failedAt: new Date().toISOString(),
              errorMessage: err.message,
            };
          }

          if (payload.retryCount > 5) {
            console.warn("⚠️ Mensagem enviada para DLQ:", payload.data?.message?.phone_number || "N/A");
            payload.failedAt = new Date().toISOString();
            payload.errorMessage = err.message;
            await channel.publish({
              exchange: "",
              routingKey: DLQ_NAME,
              body: new TextEncoder().encode(JSON.stringify(payload)),
            });
            channel.ack({ deliveryTag: args.deliveryTag });
          } else {
            console.log(
              `🔄 Reenfileirando mensagem (tentativa ${payload.retryCount}) para fila:`,
              QUEUE_NAME,
            );
            await channel.publish({
              exchange: "",
              routingKey: QUEUE_NAME,
              body: new TextEncoder().encode(JSON.stringify(payload)),
            });
            channel.ack({ deliveryTag: args.deliveryTag });
          }
        }
      });

      await new Promise(() => {}); // Mantém o consumer ativo
    } catch (error) {
      console.error("❌ Erro de conexão com RabbitMQ:", error.message);
      console.log("🔄 Tentando reconectar em 5 segundos...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

// Start
startConsumer();