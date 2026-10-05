import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { DesktopLifecycleRoot } from "../src/renderer/desktop-lifecycle-root";

const indexPath = join(import.meta.dirname, "../dist/renderer/index.html");
const html = await Bun.file(indexPath).text();
// The markup does not depend on the theme. Electron adds the saved theme to <html> when it serves the page.
const startup = renderToString(<DesktopLifecycleRoot platform={process.platform} initialAppearance={null} />);
await Bun.write(
  indexPath,
  html.replace('<div id="root"></div>', () => `<div id="root">${startup}</div>`),
);
