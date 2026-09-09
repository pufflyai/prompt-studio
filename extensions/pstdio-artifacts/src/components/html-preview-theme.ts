const themeTokens = {
  bg: "colors-bg",
  surface: "colors-bg-muted",
  fg: "colors-fg",
  muted: "colors-fg-muted",
  border: "colors-border",
  accent: "colors-fg-info",
  font: "fonts-body",
};

export const postPreviewTheme = (frame: HTMLIFrameElement | null, title: string) => {
  if (!frame) return;
  const computed = getComputedStyle(document.documentElement);
  const mode = computed.colorScheme === "dark" ? "dark" : "light";
  // The embedding element controls prefers-color-scheme inside the document.
  frame.style.colorScheme = mode;
  const variables = Object.fromEntries(
    Object.entries(themeTokens).map(([name, token]) => [
      `--artifact-${name}`,
      computed.getPropertyValue(`--chakra-${token}`).trim(),
    ]),
  );
  // Sandboxed documents have an opaque origin. Only the title and theme values cross this boundary.
  frame.contentWindow?.postMessage({ type: "pstdio.preview-theme", mode, variables, title }, "*");
};

// This function runs inside the isolated document and must have no module dependencies.
const receivePreviewTheme = (relay = false) => {
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.data?.type !== "pstdio.preview-theme") return;
    const root = document.documentElement;
    root.dataset.theme = event.data.mode;
    root.style.colorScheme = event.data.mode;
    for (const [name, value] of Object.entries(event.data.variables)) {
      if (typeof value === "string" && value) root.style.setProperty(name, value);
    }
    if (relay) {
      const frame = document.querySelector("iframe");
      if (frame) {
        frame.title = event.data.title;
        frame.style.colorScheme = event.data.mode;
        frame.contentWindow?.postMessage(event.data, "*");
      }
    }
  });
};

export const previewThemeDocument = `<style>
:root { color-scheme: light dark; }
body {
  background: var(--artifact-bg, Canvas);
  color: var(--artifact-fg, CanvasText);
  font-family: var(--artifact-font, system-ui, sans-serif);
}
</style><script>(${receivePreviewTheme.toString()})()</script>`;

export const previewThemeRelayDocument = `<script>(${receivePreviewTheme.toString()})(true)</script>`;
