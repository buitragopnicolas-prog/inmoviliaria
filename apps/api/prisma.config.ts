import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ path: '../../.env' });
config();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_MIGRATION_URL ?? env('DATABASE_URL'),
  },
});
