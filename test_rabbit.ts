import { connect } from "https://deno.land/x/amqp@v0.23.0/mod.ts";

const host = "134.209.64.170";   // IP público da VPS
const port = 5673;               // Porta customizada do RabbitMQ
const username = "testadmin";        // Usuário do RabbitMQ
const password = "test123";     // Senha do RabbitMQ
const queueName = "whatsapp_messages";

async function testRabbit() {
  try {
    const connection = await connect({
      hostname: host,
      port,          // Mantendo porta customizada
      username,
      password,
    });

    const channel = await connection.openChannel();

    // Garante que a fila exista e seja durável
    await channel.declareQueue({ queue: queueName, durable: true });

    // Publica a mensagem na fila
    const message = { test: "hello world" };
    await channel.publish(
      "", // default exchange
      queueName, // routing key = nome da fila
      new TextEncoder().encode(JSON.stringify(message)),
      { deliveryMode: 2 } // 2 = mensagem persistente
    );

    console.log("[RABBITMQ] ✅ Mensagem publicada com sucesso!");

    await channel.close();
    await connection.close();
  } catch (error) {
    console.error("[RABBITMQ] ❌ Erro ao publicar:", error);
  }
}

testRabbit();
