import { MessageChannelMain, type WebContents } from "electron";
import { renderCaptureReplySchema } from "pstdio-api-contracts/performance-diagnostics";
import { DESKTOP_CHANNELS } from "../desktop-api";

// Leave time to return an error on the existing two-second local socket.
const REQUEST_WINDOW_MS = 1_500;

export const requestRenderCapture = async (contents: WebContents | undefined) => {
  if (!contents || contents.isDestroyed()) throw new Error("Open a Prompt Studio workbench before capturing renders.");
  const { port1, port2 } = new MessageChannelMain();
  const expiresAt = Date.now() + REQUEST_WINDOW_MS;
  const response = await new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error("The workbench did not acknowledge the request. Check pst performance renders before retrying."),
        ),
      REQUEST_WINDOW_MS,
    );
    port1.once("message", ({ data }) => {
      clearTimeout(timer);
      resolve(data);
    });
    port1.once("close", () => {
      clearTimeout(timer);
      reject(new Error("The workbench closed before acknowledging the render capture."));
    });
    port1.start();
    try {
      contents.postMessage(DESKTOP_CHANNELS.requestRenderCapture, expiresAt, [port2]);
    } catch (error) {
      clearTimeout(timer);
      port2.close();
      reject(error);
    }
  }).finally(() => port1.close());
  const reply = renderCaptureReplySchema.parse(response);
  if ("error" in reply) throw new Error(reply.error);
  if (reply.capture?.status !== "recording") throw new Error("The workbench did not start a render capture.");
  return reply.capture;
};
