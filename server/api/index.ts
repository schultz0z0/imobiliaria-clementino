import { createServer } from './createServer.ts';

const app = createServer({ logger: true });
await app.listen({
  host: '0.0.0.0',
  port: Number(process.env.PORT ?? 3000),
});
