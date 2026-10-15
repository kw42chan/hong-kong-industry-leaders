import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const { pingUserData, DEFAULT_DATAFORSEO_BASE_URL } = await import(
    "../src/lib/dataforseo/client"
  );
  const baseUrl = process.env.DATAFORSEO_BASE_URL || DEFAULT_DATAFORSEO_BASE_URL;
  console.log(`Pinging ${baseUrl}/appendix/user_data ...`);

  const data = await pingUserData();
  console.log(`OK: login=${data.login} balance=${data.money?.balance}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
