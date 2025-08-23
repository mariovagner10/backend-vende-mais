import { connect, Channel, Connection, Message } from "https://deno.land/x/amqp@v0.20.0/mod.ts";

// Configurações RabbitMQ
const RABBITMQ_HOST = Deno.env.get("RABBITMQ_HOST") || "127.0.0.1";
const RABBITMQ_USERNAME = Deno.env.get("RABBITMQ_USERNAME") || "admin";
const RABBITMQ_PASSWORD = Deno.env.get("RABBITMQ_PASSWORD") || "admin123";
const QUEUE_NAME = "whatsapp_messages";
const DLQ_NAME = "whatsapp_messages_failed";
const WORKER_CONCURRENCY = parseInt(Deno.env.get("WORKER_CONCURRENCY") || "5");
const BOT_HYBRID_URL =
  Deno.env.get("BOT_HYBRID_FUNCTION_URL") ||
  "https://gythzfdqhubzzisordgq.supabase.co/functions/v1/bot-hybrid";
const FETCH_TIMEOUT = 15000; // 15 segundos

// Função para processar mensagens
async function processMessage(message: Message, channel: Channel) {
  if (!message.body) {
    console.warn("⚠️ Mensagem sem conteúdo (body undefined), ignorando...");
    channel.nack({ deliveryTag: message.deliveryTag, requeue: false });
    return;
  }

  try {
    // Decodifica mensagem como JSON puro
    const raw = new TextDecoder().decode(message.body);
    const payload: any = JSON.parse(raw);

    console.log("✅ Mensagem JSON válida:", payload);
    payload.retryCount = payload.retryCount || 0;

    // Processa mensagem via bot-hybrid
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(BOT_HYBRID_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.data),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) throw new Error(`bot-hybrid retornou status ${response.status}`);

    console.log("✅ Mensagem processada com sucesso:", payload.data?.message?.phone_number);
    channel.ack({ deliveryTag: message.deliveryTag });

  } catch (err: any) {
    console.error("❌ Erro processando mensagem:", err);

    let payload: any;
    try {
      // Tenta decodificar a mensagem original
      payload = JSON.parse(new TextDecoder().decode(message.body));
      payload.retryCount = (payload.retryCount || 0) + 1;
    } catch {
      // Se não conseguir decodificar, cria payload de erro
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
      channel.ack({ deliveryTag: message.deliveryTag });
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
      channel.ack({ deliveryTag: message.deliveryTag });
    }
  }
}

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

      const activeWorkers: Promise<void>[] = [];

      channel.consume({ queue: QUEUE_NAME, noAck: false }, async (message) => {
        if (!message) return;

        const worker = processMessage(message, channel);
        activeWorkers.push(worker);

        if (activeWorkers.length >= WORKER_CONCURRENCY) {
          await Promise.race(activeWorkers);
          for (let i = activeWorkers.length - 1; i >= 0; i--) {
            if (activeWorkers[i].finally) activeWorkers.splice(i, 1);
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
