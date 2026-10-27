import type { ParsedStorySource, ParserResult, StorySource } from "./story-parser-worker";

export const parseStorySources = async (files: StorySource[], manifest: string) => {
  const batches: StorySource[][] = [[], []];
  const sizes = [0, 0];
  for (const file of [...files].sort((a, b) => b.text.length - a.text.length)) {
    const target = sizes[0] <= sizes[1] ? 0 : 1;
    batches[target].push(file);
    sizes[target] += file.text.length;
  }
  // Parse all sources with the real Storybook parser while bounding CPU and memory use.
  const parsed = await Promise.all(
    batches
      .filter((batch) => batch.length)
      .map(async (batch) => {
        const worker = new Worker(new URL("./story-parser-worker.ts", import.meta.url).href);
        try {
          return await new Promise<ParsedStorySource[]>((resolve, reject) => {
            worker.onmessage = (event: MessageEvent<ParserResult>) => {
              if (event.data.error) reject(new Error(event.data.error));
              else resolve(event.data.files!);
            };
            worker.onerror = (event) => reject(new Error(event.message));
            worker.postMessage({ files: batch, manifest });
          });
        } finally {
          worker.terminate();
        }
      }),
  );
  return new Map(parsed.flat().map((file) => [file.source, file]));
};
