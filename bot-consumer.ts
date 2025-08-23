import { connect } from "jsr:@nashaddams/amqp";

// Tempo entre checagens de novas filas (ms)
const POLL_INTERVAL = 10000;

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

// Cria um consumidor para uma fila específica
async function consumeQueue(channel: any, queueName: string) {
  console.log("Consumindo fila:", queueName);
  await channel.declareQueue({ queue: queueName, durable: true });

  channel.consume({ queue: queueName, noAck: false }, async (message) => {
    if (!message) return;
    try {
      const payload = JSON.parse(new TextDecoder().decode(message.body));
      console.log(`[${queueName}] Mensagem recebida:`, payload);
      await processIncomingMessage(payload);
      channel.ack({ deliveryTag: message.deliveryTag });
    } catch (err) {
      console.error(`[${queueName}] Erro processando mensagem:`, err);
      channel.nack({ deliveryTag: message.deliveryTag, requeue: true });
    }
  });
}

async function startConsumer() {
  const hostname = Deno.env.get("RABBITMQ_HOST") || "rabbitmq";
  const username = Deno.env.get("RABBITMQ_USERNAME") || "admin";
  const password = Deno.env.get("RABBITMQ_PASSWORD") || "admin123";

  while (true) {
    try {
      console.log("🟡 Tentando conectar ao RabbitMQ...");
      const connection = await connect({ hostname, username, password });
      const channel = await connection.openChannel();

      console.log("🟢 Conectado ao RabbitMQ, verificando filas existentes...");

      const knownQueues = new Set<string>();

      // Função para buscar filas dinamicamente via HTTP API do RabbitMQ
      const fetchQueues = async () => {
        try {
          const rabbitmqUrl = Deno.env.get("RABBITMQ_URL") || "http://rabbitmq:15672/api";
          const auth = btoa(`${username}:${password}`);
          const res = await fetch(`${rabbitmqUrl}/queues/%2F`, {
            headers: { Authorization: `Basic ${auth}` },
          });
          const queues = await res.json();
          for (const q of queues) {
            if (q.name.startsWith("whatsapp_") && !knownQueues.has(q.name)) {
              knownQueues.add(q.name);
              await consumeQueue(channel, q.name);
            }
          }
        } catch (err) {
          console.error("❌ Erro buscando filas no RabbitMQ:", err);
        }
      };

      // Primeiro fetch
      await fetchQueues();

      // Poll periódico para detectar novas filas
      setInterval(fetchQueues, POLL_INTERVAL);

      break; // Sai do loop de reconexão, conexão está ativa

    } catch (error) {
      console.error("❌ Erro de conexão com o RabbitMQ:", error.message);
      console.log("🔄 Tentando reconectar em 5 segundos...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

startConsumer();
