import { createServer } from "node:net";

/** Keep our registry's port-zero bind from consuming the runtime's selected address. */
export const prepareUiRegistry = async <T>(origin: string, prepare: () => Promise<T>) => {
  const address = new URL(origin);
  const reservation = createServer((socket) => socket.destroy());
  await new Promise<void>((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen({ host: address.hostname, port: Number(address.port), exclusive: true }, resolve);
  });
  try {
    return await prepare();
  } finally {
    await new Promise<void>((resolve, reject) => reservation.close((error) => (error ? reject(error) : resolve())));
  }
};
