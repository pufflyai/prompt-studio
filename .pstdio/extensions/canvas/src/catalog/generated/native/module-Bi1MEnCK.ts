// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./webview-host-capabilities-BLbyfvWF.ts";
import { n as t, t as n } from "./bridge-webview-renderer-C6odAKfW.ts";
import { n as r, t as i } from "./runtime-html-CWqAw69v.ts";
// packages/pstdio-workbench/src/examples/artifacts-webview/bridge-document.ts
var a = ["artifacts.read:runs"], o = (e, t) => URL.createObjectURL(new Blob([e], { type: t })), s = (e) => `data:text/javascript;charset=utf-8,${encodeURIComponent(e)}`, c = () => "const viewHtml = `\n  <main>\n    <header>\n      <h1>Artifact reads</h1>\n      <p>This webview declared <code>artifacts.read:runs</code>. Every read below goes through the capability gate.</p>\n    </header>\n    <section aria-label=\"Artifact output\">\n      <img id=\"chart\" alt=\"chart artifact\" hidden />\n      <pre id=\"output\">Pick an action below.</pre>\n    </section>\n    <footer>\n      <button type=\"button\" data-action=\"list\">List runs/a/</button>\n      <button type=\"button\" data-action=\"summary\">Read summary.json</button>\n      <button type=\"button\" data-action=\"chart\">Show chart.png</button>\n      <button type=\"button\" class=\"secondary\" data-action=\"secrets\">Read undeclared mount</button>\n    </footer>\n  </main>\n`;\n\nconst styles = `\n  :root {\n    color-scheme: light dark;\n    font-family: Inter, ui-sans-serif, system-ui, sans-serif;\n  }\n\n  body {\n    background: var(--chakra-colors-bg-subtle, #f8fafc);\n    color: var(--chakra-colors-fg, #1f2937);\n    height: 100vh;\n    margin: 0;\n  }\n\n  main {\n    box-sizing: border-box;\n    display: grid;\n    gap: 16px;\n    grid-template-rows: auto 1fr auto;\n    height: 100%;\n    padding: 24px;\n  }\n\n  header,\n  section {\n    background: var(--chakra-colors-bg-panel, #ffffff);\n    border: 1px solid var(--chakra-colors-border-subtle, #d8dee8);\n    border-radius: 6px;\n  }\n\n  header {\n    display: grid;\n    gap: 8px;\n    padding: 16px;\n  }\n\n  h1,\n  p {\n    margin: 0;\n  }\n\n  h1 {\n    font-size: 18px;\n    font-weight: 650;\n  }\n\n  p {\n    color: var(--chakra-colors-fg-muted, #64748b);\n    font-size: 13px;\n    line-height: 1.5;\n  }\n\n  section {\n    display: grid;\n    gap: 12px;\n    min-height: 0;\n    overflow: auto;\n    padding: 16px;\n  }\n\n  img {\n    border: 1px solid var(--chakra-colors-border-subtle, #d8dee8);\n    height: 80px;\n    image-rendering: pixelated;\n    justify-self: start;\n    width: 120px;\n  }\n\n  pre {\n    color: var(--chakra-colors-fg, #334155);\n    font-size: 12px;\n    line-height: 1.5;\n    margin: 0;\n    white-space: pre-wrap;\n  }\n\n  footer {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 8px;\n  }\n\n  button {\n    align-items: center;\n    background: var(--chakra-colors-fg, #1f2937);\n    border: 0;\n    color: var(--chakra-colors-bg, #ffffff);\n    cursor: pointer;\n    display: inline-flex;\n    font: inherit;\n    font-size: 13px;\n    min-height: 32px;\n    padding: 0 12px;\n  }\n\n  button.secondary {\n    background: var(--chakra-colors-bg-muted, #fee2e2);\n    color: var(--chakra-colors-fg, #0f172a);\n  }\n`;\n\nconst show = (mount, value) => {\n  const text = typeof value === \"string\" ? value : JSON.stringify(value, null, 2);\n  mount.querySelector(\"#output\").textContent = text;\n};\n\nconst actions = {\n  list: async (mount, host) => {\n    show(mount, await host.call(\"artifacts.read\", { op: \"list\", mount: \"runs\", prefix: \"a/\" }));\n  },\n  summary: async (mount, host) => {\n    show(mount, await host.call(\"artifacts.read\", { op: \"readText\", mount: \"runs\", path: \"a/summary.json\" }));\n  },\n  chart: async (mount, host) => {\n    const url = await host.call(\"artifacts.read\", { op: \"imageUrl\", mount: \"runs\", path: \"a/chart.png\" });\n    const image = mount.querySelector(\"#chart\");\n    image.src = url;\n    image.hidden = false;\n    show(mount, \"Image URL: \" + url);\n  },\n  secrets: async (mount, host) => {\n    await host.call(\"artifacts.read\", { op: \"readText\", mount: \"secrets\", path: \"s.txt\" });\n  },\n};\n\nexport default {\n  mount(mount, host) {\n    const style = document.createElement(\"style\");\n    style.textContent = styles;\n    document.head.appendChild(style);\n    mount.innerHTML = viewHtml;\n\n    const handleClick = async (event) => {\n      const button = event.target.closest(\"button[data-action]\");\n      if (!button) return;\n      try {\n        await actions[button.dataset.action](mount, host);\n      } catch (error) {\n        show(mount, \"Denied: \" + (error instanceof Error ? error.message : String(error)));\n      }\n    };\n\n    mount.addEventListener(\"click\", handleClick);\n\n    return () => {\n      mount.removeEventListener(\"click\", handleClick);\n      mount.replaceChildren();\n      style.remove();\n    };\n  },\n};\n", l = (e) => {
	let t = o(i(e.runtimeScript), "text/html");
	return {
		moduleUrl: s(c()),
		runtimeUrl: t,
		dispose: () => {
			URL.revokeObjectURL(t);
		}
	};
}, u = () => l({ runtimeScript: r }), d = "artifacts-webview.panel", f = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAICAIAAABChommAAAANklEQVR4nGN49OIDQcQAZ1k3fUOWQOaiK4LLIXMZ0PhwEqciZDlkBgOyNJocHDGg8bEiohQBALyizkc72HIbAAAAAElFTkSuQmCC", p = [{
	path: "a/chart.png",
	size: 512,
	mediaType: "image/png"
}, {
	path: "a/summary.json",
	size: 64,
	mediaType: "application/json"
}], m = JSON.stringify({
	score: .98,
	verdict: "pass"
}, null, 2), h = async (e) => {
	let t = e;
	if (t.mount !== "runs") throw Error(`Artifact mount not found: ${t.mount}`);
	if (t.op === "list") return p.filter((e) => e.path.startsWith(t.prefix ?? ""));
	if (t.op === "readText") return m;
	if (t.op === "imageUrl") return f;
	throw Error("Unsupported artifacts.read operation.");
}, g = (r) => ({
	id: "artifacts-webview",
	activate(i) {
		let o = r.createBridgeDocument();
		return i.views.registerView({
			id: d,
			title: "Run report",
			body: {
				kind: "react",
				render: ({ workbench: r, instance: i }) => t({
					context: {
						workbench: r,
						webviewId: d,
						placement: i,
						hostEvents: n(r, i)
					},
					createHostAdapters: (t) => ({
						...e(t),
						artifacts: { read: h }
					}),
					createProps: ({ placement: e }) => ({
						placement: e,
						resource: e.resource
					}),
					ownerId: "workbench",
					title: "Run report",
					webview: {
						capabilities: [...a],
						moduleUrl: o.moduleUrl,
						runtimeUrl: o.runtimeUrl
					}
				})
			}
		}), i.overlays.registerOverlay({
			id: d,
			viewId: d
		}), i.overlays.openOverlay(d), { dispose: () => o.dispose() };
	}
});
export { u as n, g as t };
