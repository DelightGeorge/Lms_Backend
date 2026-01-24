// prisma.config.ts
import { defineConfig, env } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // This tells the CLI to use the DATABASE_URL from your .env
    url: env('DATABASE_URL'),
  },
});