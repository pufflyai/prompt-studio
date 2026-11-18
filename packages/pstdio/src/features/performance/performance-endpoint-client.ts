import { connect } from "node:net";
import { readPerformanceEndpointDescriptor } from "pstdio-paths";

const MAX_RESPONSE_LENGTH = 1_000_000;

// Reads the desktop app's local performance snapshot. Resolves null when no app on
// this device is serving one, which is the case whenever monitoring is off.
export const readPerformanceEndpoint = async (path: string, timeoutMs = 2_000) => {
  const descriptor = readPerformanceEndpointDescriptor(path);
  if (!descriptor) return null;
  return new Promise<unknown>((resolve, reject) => {
    const socket = connect(descriptor.port, "127.0.0.1");
    socket.once("connect", () => socket.write(`${descriptor.token}\n`));
    let response = "";
    socket.setEncoding("utf8");
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error("Timed out reading the performance snapshot.")));
    socket.on("data", (chunk: string) => {
      response += chunk;
      if (response.length > MAX_RESPONSE_LENGTH) socket.destroy(new Error("The performance snapshot is too large."));
    });
    socket.on("end", () => {
      try {
        resolve(JSON.parse(response));
      } catch (error) {
        reject(error);
      }
    });
    socket.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT" || error.code === "ECONNREFUSED") resolve(null);
      else reject(error);
    });
  });
};
