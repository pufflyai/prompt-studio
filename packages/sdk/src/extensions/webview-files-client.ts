import type { GuestHost } from "./guest-host";

export interface WebviewFilesClient {
  pick(opts?: { accept?: string; multiple?: boolean }): Promise<File[]>;
  upload(input: {
    name: string;
    data: Uint8Array | ArrayBuffer;
    mimeType?: string;
    scope?: { type: string; id?: string };
  }): Promise<import("pstdio-api-contracts/extension-kernel").ExtensionBlobRef>;
  /** @deprecated Invoke a command that lists extension-owned files. */
  list(input?: {
    scope?: { type: string; id?: string };
  }): Promise<import("pstdio-api-contracts/extension-kernel").ExtensionBlobRef[]>;
  /** @deprecated Invoke a command that deletes extension-owned files. */
  delete(id: string): Promise<void>;
}

const pickFiles = (opts: { accept?: string; multiple?: boolean } = {}) =>
  new Promise<File[]>((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = opts.accept ?? "";
    input.multiple = opts.multiple ?? false;
    input.style.display = "none";
    input.addEventListener("change", () => {
      const files = input.files ? Array.from(input.files) : [];
      input.remove();
      resolve(files);
    });
    input.addEventListener("cancel", () => {
      input.remove();
      resolve([]);
    });
    input.addEventListener("error", () => {
      input.remove();
      reject(new Error("Could not pick files."));
    });
    document.body.appendChild(input);
    input.click();
  });

export const createWebviewFilesClient = (host: GuestHost): WebviewFilesClient => ({
  pick: pickFiles,
  upload: (input) => host.call("files.upload", input),
  list: async (input) => {
    const response = await host.call("files.list", input ?? {});
    return response.files;
  },
  delete: (id) => host.call("files.delete", { id }),
});
