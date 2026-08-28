import Fastify from 'fastify';

const app = Fastify();

app.get('/health', async () => ({ status: 'ok' }));

await app.listen({
  host: '0.0.0.0',
  port: Number(process.env.PORT ?? 3000),
});
