import { createEnvironmentAccessVerifier } from "../src/environment-access";

try {
  const { trust, token } = await Bun.stdin.json();
  console.log(JSON.stringify(await createEnvironmentAccessVerifier(trust)(token)));
} catch {
  console.error("Environment verification failed");
  process.exitCode = 1;
}
