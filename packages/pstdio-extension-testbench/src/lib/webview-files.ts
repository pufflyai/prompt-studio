import type { ExtensionWebviewFileCapabilities } from "@pstdio/workbench/extensions";

type WebviewFileScope = { type: string; id?: string };

type PreviewBlobRef = {
  id: string;
  name: string;
  mimeType: string | null;
  size: number;
  scope?: WebviewFileScope;
  url: string;
};

type PreviewBlobRecord = PreviewBlobRef & {
  data: Uint8Array;
};

const scopeKey = (scope: WebviewFileScope | undefined) => JSON.stringify(scope ?? { type: "project" });

const toBytes = (data: ArrayBuffer | Uint8Array) => (data instanceof Uint8Array ? data : new Uint8Array(data));

const toRef = (record: PreviewBlobRecord): PreviewBlobRef => ({
  id: record.id,
  name: record.name,
  mimeType: record.mimeType,
  size: record.size,
  scope: record.scope,
  url: record.url,
});

export const createPreviewWebviewFileHost = () => {
  const files = new Map<string, PreviewBlobRecord>();

  return {
    upload(input) {
      const data = toBytes(input.data);
      const id = crypto.randomUUID();
      const record = {
        data,
        id,
        mimeType: input.mimeType ?? null,
        name: input.name,
        scope: input.scope,
        size: data.byteLength,
        url: `bench://webview-files/${encodeURIComponent(id)}`,
      };
      files.set(id, record);
      return toRef(record);
    },
    list(input) {
      const requestedScope = scopeKey(input.scope);
      return {
        files: [...files.values()].filter((file) => scopeKey(file.scope) === requestedScope).map(toRef),
      };
    },
    delete(input) {
      files.delete(input.id);
    },
  } satisfies ExtensionWebviewFileCapabilities;
};
