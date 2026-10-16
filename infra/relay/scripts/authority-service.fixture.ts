import { createAccountManager, createEnvironmentAuthorityHandler } from "pstdio-account-manager";

const manager = createAccountManager(process.env.MANAGER_DATABASE_URL!);
const server = Bun.serve({
  hostname: "0.0.0.0",
  port: 8443,
  tls: { cert: Bun.file("/tls-public/authority-cert.pem"), key: Bun.file("/tls-private/authority-key.pem") },
  fetch: createEnvironmentAuthorityHandler(manager, { serviceSecret: process.env.MANAGER_SERVICE_SECRET! }),
});
const shutdown = async () => {
  await server.stop(true);
  await manager.close();
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
