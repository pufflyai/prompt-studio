import { createRequire } from "node:module";

export interface StorySource {
  source: string;
  text: string;
}
export interface ParsedStorySource {
  source: string;
  title: string;
  component?: string;
  componentImport?: string;
  stories: { exportName: string; id: string; name: string; defaultTheme?: string }[];
}
interface ParserInput {
  manifest: string;
  files: StorySource[];
}
export interface ParserResult {
  files?: ParsedStorySource[];
  error?: string;
}
const worker = globalThis as unknown as {
  onmessage: (event: MessageEvent<ParserInput>) => void;
  postMessage: (result: ParserResult) => void;
};
worker.onmessage = async (event) => {
  try {
    const { files, manifest } = event.data;
    const { indexExamples } = await import(createRequire(manifest).resolve("@pstdio/canvas/indexer"));
    worker.postMessage({
      files: files.map(({ source, text }) => ({ source, ...indexExamples(source, text) })),
    });
  } catch (error) {
    worker.postMessage({ error: String(error) });
  }
};
