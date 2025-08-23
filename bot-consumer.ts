import { connect, Channel, Connection, Message } from "https://deno.land/x/amqp@v0.20.0/mod.ts";

// Configurações RabbitMQ
const RABBITMQ_HOST = Deno.env.get("RABBITMQ_HOST") || "127.0.0.1";
const RABBITMQ_USERNAME = Deno.env.get("RABBITMQ_USERNAME") || "admin";
const RABBITMQ_PASSWORD = Deno.env.get("RABBITMQ_PASSWORD") || "admin123";
const QUEUE_NAME = "whatsapp_messages";
const DLQ_NAME = "whatsapp_messages_failed";
const WORKER_CONCURRENCY = parseInt(Deno.env.get("WORKER_CONCURRENCY") || "5");
const BOT_HYBRID_URL = Deno.env.get("BOT_HYBRID_FUNCTION_URL") || "https://gythzfdqhubzzisordgq.supabase.co/functions/v1/bot-hybrid";
const FETCH_TIMEOUT = 15000; // 15 segundos

// Função para processar mensagens
async function processMessage(message: Message, channel: Channel) {
  // Checa se existe conteúdo
  if (!message.content) {
    console.warn("⚠️ Mensagem sem conteúdo (content undefined), ignorando...");
    channel.nack({ deliveryTag: message.deliveryTag, requeue: false });
    return;
  }

  console.log("➡️ Mensagem recebida do consumer");
  console.log("📦 Mensagem recebida raw (bytes):", message.content);
  console.log("📦 Mensagem recebida raw (base64):", btoa(String.fromCharCode(...message.content)));

  const raw = new TextDecoder().decode(message.content);
  console.log("📜 Mensagem decodificada (string):", raw);

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    console.warn("⚠️ Mensagem inválida (não JSON):", raw);
    console.error("⚠️ Erro parse JSON:", err);
    channel.nack({ deliveryTag: message.deliveryTag, requeue: false });
    return;
  }

  console.log("✅ Mensagem JSON válida:", payload);
  payload.retryCount = payload.retryCount || 0;

  try {
    console.log(`📩 Processando mensagem do petshop ${payload.petshopId}:`, payload.data.message.phone_number);

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

    console.log("✅ Mensagem processada com sucesso pelo bot-hybrid:", payload.data.message.phone_number);
    channel.ack({ deliveryTag: message.deliveryTag });
  } catch (err) {
    console.error("❌ Erro processando mensagem:", err);

    payload.retryCount++;

    if (payload.retryCount > 5) {
      console.warn("⚠️ Mensagem enviada para DLQ após múltiplas tentativas:", payload.data.message.phone_number);
      payload.failedAt = new Date().toISOString();
      payload.errorMessage = err.message;

      console.log("📥 Publicando mensagem na DLQ:", DLQ_NAME);
      await channel.publish({
        exchange: "",
        routingKey: DLQ_NAME,
        body: new TextEncoder().encode(JSON.stringify(payload)),
      });
      channel.ack({ deliveryTag: message.deliveryTag });
    } else {
      console.log(`🔄 Reenfileirando mensagem (tentativa ${payload.retryCount}) para fila:`, QUEUE_NAME);
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
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Start
startConsumer();
