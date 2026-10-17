import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { DesktopLifecycleRoot } from "../src/renderer/desktop-lifecycle-root";

const indexPath = join(import.meta.dirname, "../dist/renderer/index.html");
const html = await Bun.file(indexPath).text();
// The markup does not depend on the theme. Electron adds the saved theme to <html> when it serves the page.
const startup = renderToString(<DesktopLifecycleRoot platform={process.platform} initialAppearance={null} />);
// Keep the shared font and icon styles in the first document, so its first paint
// does not wait for another custom-protocol request.
const styles = /<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g;
let styledHtml = html;
for (const match of html.matchAll(styles)) {
  const css = await Bun.file(join(import.meta.dirname, "../dist/renderer", match[1]!)).text();
  styledHtml = styledHtml.replace(match[0], () => `<style>${css}</style>`);
}
await Bun.write(
  indexPath,
  styledHtml.replace('<div id="root"></div>', () => `<div id="root">${startup}</div>`),
);
