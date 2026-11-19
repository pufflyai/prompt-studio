import type { WebviewFilesDownloadParams } from "pstdio-api-contracts/extension-kernel";

/** Run in the host document so the extension's sandbox never gains download permission. */
export const downloadExtensionFile = (input: WebviewFilesDownloadParams) => {
  const data = new Uint8Array(input.data instanceof ArrayBuffer ? input.data : input.data.slice());
  const url = URL.createObjectURL(new Blob([data], { type: input.mimeType ?? "application/octet-stream" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = input.name;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Navigation consumes the URL after the initiating task, including on WebKit.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
};
