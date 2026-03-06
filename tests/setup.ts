// Set test environment variables before anything else
process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.CLERK_SECRET_KEY = "sk_test_fake_key";
process.env.ZYNK_API_BASE_URL = "https://fake-zynk.test";
process.env.ZYNK_API_TOKEN = "fake-zynk-token";
process.env.ZYNK_WEBHOOK_SECRET = "test-webhook-secret";
process.env.ZYNK_INR_ROUTING_ID = "infrap_test";
process.env.ZYNK_US_ROUTING_ID = "infrap_test_us";
process.env.ZYNK_US_JURISDICTION_ID = "jurisdiction_test_us";
process.env.ZYNK_INR_JURISDICTION_ID = "jurisdiction_test_inr";
process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef";
process.env.GOOGLE_APP_PASSWORD = "fake";
process.env.GOOGLE_EMAIL = "test@test.com";
process.env.DATABASE_URL = "postgres://fake:fake@localhost:5432/fake";
