import { connect } from "node:net";
import type { RenderCaptureOperation } from "pstdio-api-contracts/performance-diagnostics";
import { readPerformanceEndpointDescriptor } from "pstdio-paths";

const MAX_RESPONSE_LENGTH = 1_000_000;

// Reads the desktop app's local performance snapshot. Resolves null when no app on
// this device is serving one, which is the case whenever monitoring is off.
export const requestPerformanceEndpoint = async (path: string, operation?: RenderCaptureOperation) => {
  const descriptor = readPerformanceEndpointDescriptor(path);
  if (!descriptor) return null;
  return new Promise<unknown>((resolve, reject) => {
    const socket = connect(descriptor.port, "127.0.0.1");
    socket.once("connect", () =>
      socket.write(operation ? `${descriptor.token} ${operation}\n` : `${descriptor.token}\n`),
    );
    let response = "";
    socket.setEncoding("utf8");
    socket.setTimeout(2_000, () => socket.destroy(new Error("Timed out waiting for the local performance endpoint.")));
    socket.on("data", (chunk: string) => {
      response += chunk;
      if (response.length > MAX_RESPONSE_LENGTH) socket.destroy(new Error("The performance snapshot is too large."));
    });
    socket.on("end", () => {
      try {
        if (operation && !response) throw new Error("This desktop does not support local React render captures.");
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
