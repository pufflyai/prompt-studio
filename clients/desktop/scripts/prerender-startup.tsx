import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { DesktopLifecycleRoot } from "../src/renderer/desktop-lifecycle-root";

const indexPath = join(import.meta.dirname, "../dist/renderer/index.html");
const html = await Bun.file(indexPath).text();
const startup = renderToString(<DesktopLifecycleRoot platform={process.platform} />);
await Bun.write(
  indexPath,
  html.replace('<div id="root"></div>', () => `<div id="root">${startup}</div>`),
);
