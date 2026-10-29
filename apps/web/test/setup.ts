import { vi } from 'vitest';
import { testDatabaseUrl, testRedisUrl } from './test-env';

// Must be set before any app module creates its database or Redis client
process.env.DATABASE_URL = testDatabaseUrl();
process.env.REDIS_URL = testRedisUrl();
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_for_tests';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.STRIPE_PRICE_ID_PRO = 'price_test_pro';
process.env.STRIPE_PRICE_ID_ENTERPRISE = 'price_test_enterprise';

// Tests choose who is signed in (see helpers.signInAs)
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn(async () => undefined) }));

// The queue is replaced so tests don't need a worker (see helpers.queuedExports)
vi.mock('@/server/queue', () => ({ addExportJob: vi.fn(async () => undefined) }));
