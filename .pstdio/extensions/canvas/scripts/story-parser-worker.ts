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
  stories: { exportName: string; id: string; name: string }[];
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
    const { manifest, files } = event.data;
    const require = createRequire(manifest);
    const { loadCsf } = await import(require.resolve("storybook/internal/csf-tools"));
    worker.postMessage({
      files: files.map(({ source, text }) => {
        const csf = loadCsf(text, {
          fileName: source,
          makeTitle: (title?: string) => title ?? source.replace(/\.stories\.tsx?$/, ""),
        }).parse();
        return {
          source,
          title: csf.meta.title,
          component: csf.meta.component,
          componentImport: csf._rawComponentPath,
          stories: Object.entries(csf._stories).map(([exportName, story]) => {
            const { id, name } = story as { id: string; name: string };
            return { exportName, id, name };
          }),
        };
      }),
    });
  } catch (error) {
    worker.postMessage({ error: String(error) });
  }
};
