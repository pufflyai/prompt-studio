// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./circle-B0quX-xX.ts";
import { t } from "./plus-CYkLGSPS.ts";
import { t as n } from "./trash-2-C03vrbuo.ts";
import { a as r, o as i, s as a, t as o } from "./test-CYwQ_LKY.ts";
import { m as s, t as c } from "./workbench-core-kaLFKJEn.ts";
import { r as l } from "./module-DpMmoxZD.ts";
import { t as u } from "./module-BQkLCofd.ts";
import { t as d } from "./workbench-story-BezxAS71.ts";
import { t as f } from "./host-terminal-story-CcKW5EdM.ts";
import { n as p, r as m, t as ee } from "./module-CX-KuAZH.ts";
import { t as te } from "./module-CxX_23sA.ts";
import { t as ne } from "./module-By0YOr9e.ts";
import { t as re } from "./module-BTNLoyTW.ts";
import { t as ie } from "./host-terminal-story-DEt3KhcK.ts";
import { n as ae, t as oe } from "./module-Bi1MEnCK.ts";
import { useSyncExternalStore as h } from "react";
import { Badge as se, Box as g, Button as _, HStack as v, Icon as y, IconButton as b, Input as x, Menu as S, Portal as C, Stack as w, Text as T } from "@chakra-ui/react";
import { ScrollArea as ce, Switch as le } from "@pstdio/ui";
import { jsx as E, jsxs as D } from "react/jsx-runtime";
import { isEnumOptionsSource as O } from "@pstdio/ui/kanban-renderer";
// packages/pstdio-workbench/src/examples/artifacts-webview/module.tsx?raw
var ue = "import type { WorkbenchModuleContribution } from \"../../core\";\nimport {\n  createWorkbenchWebviewHostAdapters,\n  getBridgeWebviewHostEventPublisher,\n  renderBridgeWebviewFrame,\n} from \"../../extensions\";\nimport type { ArtifactsBridgeDocumentAssets } from \"./bridge-document\";\nimport { artifactsWebviewCapabilities } from \"./bridge-document\";\n\nexport interface CreateArtifactsWebviewExampleModuleInput {\n  createBridgeDocument: () => ArtifactsBridgeDocumentAssets;\n}\n\nconst panelId = \"artifacts-webview.panel\";\n\n// A 12x8 bar-chart png, standing in for the short-lived signed URL the API mints.\nconst chartImageUrl =\n  \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAICAIAAABChommAAAANklEQVR4nGN49OIDQcQAZ1k3fUOWQOaiK4LLIXMZ0PhwEqciZDlkBgOyNJocHDGg8bEiohQBALyizkc72HIbAAAAAElFTkSuQmCC\";\n\nconst artifactFiles = [\n  { path: \"a/chart.png\", size: 512, mediaType: \"image/png\" },\n  { path: \"a/summary.json\", size: 64, mediaType: \"application/json\" },\n];\n\nconst summaryText = JSON.stringify({ score: 0.98, verdict: \"pass\" }, null, 2);\n\n// In-memory stand-in for the API-backed implementation. The capability gate in\n// front of it is the real one: calls for mounts outside the declared\n// `artifacts.read:runs` grant never reach this function.\nconst readArtifacts = async (params: unknown) => {\n  const request = params as { op: string; mount: string; path?: string; prefix?: string };\n  if (request.mount !== \"runs\") throw new Error(`Artifact mount not found: ${request.mount}`);\n  if (request.op === \"list\") return artifactFiles.filter((file) => file.path.startsWith(request.prefix ?? \"\"));\n  if (request.op === \"readText\") return summaryText;\n  if (request.op === \"imageUrl\") return chartImageUrl;\n  throw new Error(\"Unsupported artifacts.read operation.\");\n};\n\nexport const createArtifactsWebviewExampleModule = (\n  input: CreateArtifactsWebviewExampleModuleInput,\n): WorkbenchModuleContribution => ({\n  id: \"artifacts-webview\",\n  activate(ctx) {\n    const bridgeDocument = input.createBridgeDocument();\n    ctx.views.registerView({\n      id: panelId,\n      title: \"Run report\",\n      body: {\n        kind: \"react\",\n        render: ({ workbench, instance }) =>\n          renderBridgeWebviewFrame({\n            context: {\n              workbench,\n              webviewId: panelId,\n              placement: instance,\n              hostEvents: getBridgeWebviewHostEventPublisher(workbench, instance),\n            },\n            createHostAdapters: (context) => ({\n              ...createWorkbenchWebviewHostAdapters(context),\n              artifacts: { read: readArtifacts },\n            }),\n            createProps: ({ placement }) => ({ placement, resource: placement.resource }),\n            ownerId: \"workbench\",\n            title: \"Run report\",\n            webview: {\n              capabilities: [...artifactsWebviewCapabilities],\n              moduleUrl: bridgeDocument.moduleUrl,\n              runtimeUrl: bridgeDocument.runtimeUrl,\n            },\n          }),\n      },\n    });\n    ctx.overlays.registerOverlay({\n      id: panelId,\n      viewId: panelId,\n    });\n    ctx.overlays.openOverlay(panelId);\n\n    return { dispose: () => bridgeDocument.dispose() };\n  },\n});\n", de = async (e, t) => {
	let n = a(e), s = "file-renderer.story.markdown.widget", c = t.views.getView(s)?.body;
	if (c?.kind !== "file" || !c.save) throw Error("The markdown example must be editable.");
	let l = e.ownerDocument, u = () => n.getByRole("textbox");
	await r.click(await n.findByRole("tab", { name: "notes.md" })), await n.findByRole("textbox"), await r.click(n.getByRole("button", { name: "Close notes.md" })), await i(() => o(n.queryByRole("tab", { name: "notes.md" })).toBeNull()), await c.save(void 0, "# External write\n\nChanged while the document was closed."), t.views.refreshView(s), await r.click(n.getByRole("button", { name: "Add panel" })), await i(() => o(u()).toHaveTextContent("Changed while the document was closed.")), await c.save(void 0, "# External write\n\nChanged while the document was open."), t.views.refreshView(s), await i(() => o(u()).toHaveTextContent("Changed while the document was open."));
	let d = u();
	await r.click(d);
	let f = l.getSelection(), p = l.createRange();
	p.selectNodeContents(d), p.collapse(!1), f?.removeAllRanges(), f?.addRange(p), await r.paste(" Saved marker."), p.selectNodeContents(d), f?.removeAllRanges(), f?.addRange(p);
	let m = f?.toString();
	await o(m).toContain("Changed while the document was open."), await i(async () => o((await c.load(void 0, new AbortController().signal)).content).toContain("Saved marker.")), t.views.refreshView(s), await new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(() => e()))), await o(u()).toBe(d), await o(d).toHaveFocus(), await o(l.getSelection()?.toString()).toBe(m);
}, fe = "file-renderer.story.placeholder", k = "file-renderer.story.placeholder.renderer", A = "file-renderer.story.markdown.widget", j = "# File renderer\n\nThis document is rendered by the **MarkdownEditor**. Edit it — changes autosave\nthrough the renderer's `save` command.\n\n- markdown for `.md` / `.txt`\n- Monaco for code files\n- read-only `<img>` for images", M = "export const greet = (name: string) => {\n  // Edited in the Monaco code editor.\n  return `Hello, ${name}`;\n};\n", pe = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22240%22%20height%3D%22160%22%3E%3Crect%20width%3D%22240%22%20height%3D%22160%22%20rx%3D%2212%22%20fill%3D%22%235b8def%22%2F%3E%3Ctext%20x%3D%22120%22%20y%3D%2290%22%20font-family%3D%22sans-serif%22%20font-size%3D%2220%22%20fill%3D%22white%22%20text-anchor%3D%22middle%22%3Eimage%3C%2Ftext%3E%3C%2Fsvg%3E", me = [
	{
		rendererId: "file-renderer.story.markdown",
		panelId: A,
		title: "notes.md",
		load: () => ({
			fileName: "notes.md",
			content: j
		}),
		save: (e, t) => {
			j = t;
		}
	},
	{
		rendererId: "file-renderer.story.code",
		panelId: "file-renderer.story.code.widget",
		title: "example.ts",
		load: () => ({
			fileName: "example.ts",
			content: M
		}),
		save: (e, t) => {
			M = t;
		}
	},
	{
		rendererId: "file-renderer.story.image",
		panelId: "file-renderer.story.image.widget",
		title: "logo.svg",
		load: () => ({
			fileName: "logo.svg",
			mimeType: "image/svg+xml",
			dataUrl: pe
		})
	}
], he = (e) => {
	let { onWrite: t } = e;
	return /* @__PURE__ */ D(w, {
		p: "md",
		gap: "sm",
		align: "start",
		children: [/* @__PURE__ */ E(T, {
			textStyle: "paragraph/XS/regular",
			color: "fg.muted",
			children: "Replace notes.md from outside the editor."
		}), /* @__PURE__ */ E(_, {
			size: "xs",
			variant: "subtle",
			onClick: t,
			children: "Write notes.md externally"
		})]
	});
}, ge = () => ({
	id: "file-renderer.story",
	activate(e) {
		e.views.registerView({
			id: k,
			title: "Documents",
			body: {
				kind: "react",
				render: () => /* @__PURE__ */ E(he, { onWrite: () => {
					j = `# Written outside the editor\n\nAn agent or the CLI replaced this document at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}.`, e.views.refreshView(A);
				} })
			}
		}), e.placeholders.registerPlaceholder({
			id: fe,
			viewId: k,
			region: "main"
		});
		for (let t of me) e.views.registerView({
			id: t.panelId,
			title: t.title,
			body: {
				kind: "file",
				load: t.load,
				save: "save" in t ? t.save : void 0
			}
		}), e.shellPlacements.registerPlacement({
			id: t.panelId,
			item: {
				kind: "view",
				presence: "open",
				view: {
					kind: "view",
					id: t.panelId
				}
			},
			region: "main"
		});
	}
}), _e = () => ({
	id: "file-renderer.error-story",
	activate(e) {
		let t = "file-renderer.story.load-error.widget";
		e.views.registerView({
			id: t,
			title: "unavailable.md",
			body: {
				kind: "file",
				load: async () => {
					throw Error("The document could not be loaded.");
				},
				save: () => {}
			}
		}), e.shellPlacements.registerPlacement({
			id: t,
			item: {
				kind: "view",
				presence: "open",
				view: {
					kind: "view",
					id: t
				}
			},
			region: "main"
		});
	}
}), N = "import { Button, Stack, Text } from \"@chakra-ui/react\";\nimport type { WorkbenchModuleContribution } from \"../../core\";\n\nconst PANEL_PLACEHOLDER_ID = \"file-renderer.story.placeholder\";\nconst PANEL_PLACEHOLDER_RENDERER_ID = \"file-renderer.story.placeholder.renderer\";\nconst MARKDOWN_PANEL_ID = \"file-renderer.story.markdown.widget\";\n// In-memory documents the example file renderers read and write. The markdown and\n// code renderers are editable (they declare a `save`); the image is read-only.\nlet markdownContent = [\n  \"# File renderer\",\n  \"\",\n  \"This document is rendered by the **MarkdownEditor**. Edit it — changes autosave\",\n  \"through the renderer's `save` command.\",\n  \"\",\n  \"- markdown for `.md` / `.txt`\",\n  \"- Monaco for code files\",\n  \"- read-only `<img>` for images\",\n].join(\"\\n\");\nlet codeContent = [\n  \"export const greet = (name: string) => {\",\n  \"  // Edited in the Monaco code editor.\",\n  `  return \\`Hello, \\${name}\\`;`,\n  \"};\",\n  \"\",\n].join(\"\\n\");\nconst imageDataUrl = `data:image/svg+xml,${encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"240\" height=\"160\"><rect width=\"240\" height=\"160\" rx=\"12\" fill=\"#5b8def\"/><text x=\"120\" y=\"90\" font-family=\"sans-serif\" font-size=\"20\" fill=\"white\" text-anchor=\"middle\">image</text></svg>')}`;\nconst renderers = [\n  {\n    rendererId: \"file-renderer.story.markdown\",\n    panelId: MARKDOWN_PANEL_ID,\n    title: \"notes.md\",\n    load: () => ({ fileName: \"notes.md\", content: markdownContent }),\n    save: (_resource: unknown, content: string) => {\n      markdownContent = content;\n    },\n  },\n  {\n    rendererId: \"file-renderer.story.code\",\n    panelId: \"file-renderer.story.code.widget\",\n    title: \"example.ts\",\n    load: () => ({ fileName: \"example.ts\", content: codeContent }),\n    save: (_resource: unknown, content: string) => {\n      codeContent = content;\n    },\n  },\n  {\n    rendererId: \"file-renderer.story.image\",\n    panelId: \"file-renderer.story.image.widget\",\n    title: \"logo.svg\",\n    load: () => ({ fileName: \"logo.svg\", mimeType: \"image/svg+xml\", dataUrl: imageDataUrl }),\n  },\n] as const;\n// Stands in for an agent or the CLI writing the document while the workbench is\n// open: the editor must show the new text without losing an unsaved local edit.\nconst ExternalWriteControl = (props: { onWrite: () => void }) => {\n  const { onWrite } = props;\n  return (\n    <Stack p=\"md\" gap=\"sm\" align=\"start\">\n      <Text textStyle=\"paragraph/XS/regular\" color=\"fg.muted\">\n        Replace notes.md from outside the editor.\n      </Text>\n      <Button size=\"xs\" variant=\"subtle\" onClick={onWrite}>\n        Write notes.md externally\n      </Button>\n    </Stack>\n  );\n};\nexport const createFileRendererStoryModule = (): WorkbenchModuleContribution => ({\n  id: \"file-renderer.story\",\n  activate(ctx) {\n    ctx.views.registerView({\n      id: PANEL_PLACEHOLDER_RENDERER_ID,\n      title: \"Documents\",\n      body: {\n        kind: \"react\",\n        render: () => (\n          <ExternalWriteControl\n            onWrite={() => {\n              markdownContent = `# Written outside the editor\\n\\nAn agent or the CLI replaced this document at ${new Date().toLocaleTimeString()}.`;\n              ctx.views.refreshView(MARKDOWN_PANEL_ID);\n            }}\n          />\n        ),\n      },\n    });\n    ctx.placeholders.registerPlaceholder({\n      id: PANEL_PLACEHOLDER_ID,\n      viewId: PANEL_PLACEHOLDER_RENDERER_ID,\n      region: \"main\",\n    });\n    for (const renderer of renderers) {\n      ctx.views.registerView({\n        id: renderer.panelId,\n        title: renderer.title,\n        body: {\n          kind: \"file\",\n          load: renderer.load,\n          save: \"save\" in renderer ? renderer.save : undefined,\n        },\n      });\n      ctx.shellPlacements.registerPlacement({\n        id: renderer.panelId,\n        item: {\n          kind: \"view\",\n          presence: \"open\",\n          view: {\n            kind: \"view\",\n            id: renderer.panelId,\n          },\n        },\n        region: \"main\",\n      });\n    }\n  },\n});\nexport const createFileRendererErrorStoryModule = (): WorkbenchModuleContribution => ({\n  id: \"file-renderer.error-story\",\n  activate(ctx) {\n    const panelId = \"file-renderer.story.load-error.widget\";\n    ctx.views.registerView({\n      id: panelId,\n      title: \"unavailable.md\",\n      body: {\n        kind: \"file\",\n        load: async () => {\n          throw new Error(\"The document could not be loaded.\");\n        },\n        save: () => {},\n      },\n    });\n    ctx.shellPlacements.registerPlacement({\n      id: panelId,\n      item: {\n        kind: \"view\",\n        presence: \"open\",\n        view: {\n          kind: \"view\",\n          id: panelId,\n        },\n      },\n      region: \"main\",\n    });\n  },\n});\n", P = "hello-world.empty-main", F = "hello-world.welcome", I = "hello-world.openWelcome", ve = s("main"), L = (e) => {
	let { title: t, description: n } = e;
	return /* @__PURE__ */ D("div", {
		style: { padding: 24 },
		children: [/* @__PURE__ */ E("h1", {
			style: { marginTop: 0 },
			children: t
		}), /* @__PURE__ */ E("p", { children: n })]
	});
}, ye = () => ({
	id: "hello-world",
	activate(e) {
		e.views.registerView({
			id: F,
			title: "Welcome",
			body: {
				kind: "react",
				render: () => /* @__PURE__ */ E(L, {
					title: "Hello world",
					description: "A workbench module rendered into the main region."
				})
			}
		}), e.shellPlacements.registerPlacement({
			id: F,
			item: {
				kind: "view",
				presence: "closed",
				view: {
					kind: "view",
					id: F
				}
			},
			region: "main"
		}), e.views.registerView({
			id: P,
			title: "Empty main",
			body: {
				kind: "react",
				render: () => /* @__PURE__ */ E(L, {
					title: "Nothing open",
					description: "Open a widget to get started."
				})
			}
		}), e.placeholders.registerPlaceholder({
			id: P,
			viewId: P,
			region: "main"
		}), e.commands.registerCommand({
			id: I,
			label: "Open tab",
			category: "Hello world",
			icon: "plus"
		}, { execute: () => e.navigation.openPanel({ panel: {
			kind: "shell-placement",
			id: F
		} }) }), e.layout.registerMenuItem(ve, {
			commandId: I,
			group: "primary",
			order: 10
		});
	}
}), be = "import { headerTrailingMenuPath, type WorkbenchModuleContribution } from \"../../core\";\n\nconst emptyMainViewId = \"hello-world.empty-main\";\nconst welcomeWidgetId = \"hello-world.welcome\";\nconst openWelcomeCommandId = \"hello-world.openWelcome\";\nconst mainHeaderTrailingMenuPath = headerTrailingMenuPath(\"main\");\nconst ExamplePanel = (props: { title: string; description: string }) => {\n  const { title, description } = props;\n  return (\n    <div style={{ padding: 24 }}>\n      <h1 style={{ marginTop: 0 }}>{title}</h1>\n      <p>{description}</p>\n    </div>\n  );\n};\nexport const createHelloWorldModule = (): WorkbenchModuleContribution => ({\n  id: \"hello-world\",\n  activate(ctx) {\n    ctx.views.registerView({\n      id: welcomeWidgetId,\n      title: \"Welcome\",\n      body: {\n        kind: \"react\",\n        render: () => (\n          <ExamplePanel title=\"Hello world\" description=\"A workbench module rendered into the main region.\" />\n        ),\n      },\n    });\n    ctx.shellPlacements.registerPlacement({\n      id: welcomeWidgetId,\n      item: {\n        kind: \"view\",\n        presence: \"closed\",\n        view: {\n          kind: \"view\",\n          id: welcomeWidgetId,\n        },\n      },\n      region: \"main\",\n    });\n    ctx.views.registerView({\n      id: emptyMainViewId,\n      title: \"Empty main\",\n      body: {\n        kind: \"react\",\n        render: () => <ExamplePanel title=\"Nothing open\" description=\"Open a widget to get started.\" />,\n      },\n    });\n    ctx.placeholders.registerPlaceholder({\n      id: emptyMainViewId,\n      viewId: emptyMainViewId,\n      region: \"main\",\n    });\n    ctx.commands.registerCommand(\n      {\n        id: openWelcomeCommandId,\n        label: \"Open tab\",\n        category: \"Hello world\",\n        icon: \"plus\",\n      },\n      {\n        execute: () => ctx.navigation.openPanel({ panel: { kind: \"shell-placement\", id: welcomeWidgetId } }),\n      },\n    );\n    ctx.layout.registerMenuItem(mainHeaderTrailingMenuPath, {\n      commandId: openWelcomeCommandId,\n      group: \"primary\",\n      order: 10,\n    });\n  },\n});\n", R = "kanban-renderer.story.rows", xe = "kanban-renderer.story.row", z = "kanban-renderer.story.editor", B = ((e) => {
	let t = e, n = /* @__PURE__ */ new Set();
	return {
		source: {
			subscribe: (e) => (n.add(e), () => {
				n.delete(e);
			}),
			getSnapshot: () => t
		},
		getAttributes: () => t,
		setAttributes: (e) => {
			t = e;
			for (let e of n) e();
		}
	};
})([
	{
		id: "status",
		label: "Status",
		type: {
			kind: "enum",
			options: [
				{
					value: "backlog",
					label: "Backlog",
					color: "gray"
				},
				{
					value: "in-progress",
					label: "In progress",
					color: "blue"
				},
				{
					value: "review",
					label: "Review",
					color: "purple"
				},
				{
					value: "done",
					label: "Done",
					color: "green"
				}
			]
		},
		filterable: !0,
		groupable: !0,
		sortable: !0,
		displayable: !0
	},
	{
		id: "assignee",
		label: "Assignee",
		type: { kind: "user" },
		filterable: !0,
		groupable: !0,
		displayable: !0
	},
	{
		id: "priority",
		label: "Priority",
		type: {
			kind: "enum",
			options: [
				{
					value: "high",
					label: "High",
					color: "red"
				},
				{
					value: "medium",
					label: "Medium",
					color: "yellow"
				},
				{
					value: "low",
					label: "Low",
					color: "gray"
				}
			]
		},
		filterable: !0,
		groupable: !0,
		sortable: !0,
		displayable: !0
	},
	{
		id: "region",
		label: "Region",
		type: {
			kind: "enum",
			options: [
				{
					value: "renderer",
					label: "Renderer",
					color: "blue"
				},
				{
					value: "workbench",
					label: "Workbench",
					color: "purple"
				},
				{
					value: "ui",
					label: "UI",
					color: "green"
				}
			]
		},
		filterable: !0,
		groupable: !0,
		displayable: !0
	},
	{
		id: "updated",
		label: "Updated",
		type: { kind: "date" },
		sortable: !0,
		displayable: !0
	}
]), Se = [
	{
		id: "DR-1",
		title: "Schema-aware grouping",
		status: "in-progress",
		assignee: "Aure",
		priority: "high",
		region: "renderer",
		updated: "2026-05-17T09:00:00Z"
	},
	{
		id: "DR-2",
		title: "Toolbar state wiring",
		status: "review",
		assignee: "Mika",
		priority: "high",
		region: "workbench",
		updated: "2026-05-16T18:30:00Z"
	},
	{
		id: "DR-3",
		title: "Filter expression mapping",
		status: "backlog",
		assignee: "Sam",
		priority: "medium",
		region: "workbench",
		updated: "2026-05-15T12:00:00Z"
	},
	{
		id: "DR-4",
		title: "executeQuery callbacks",
		status: "in-progress",
		assignee: "Aure",
		priority: "medium",
		region: "renderer",
		updated: "2026-05-15T10:15:00Z"
	},
	{
		id: "DR-5",
		title: "Display state isolation",
		status: "done",
		assignee: "Nora",
		priority: "low",
		region: "renderer",
		updated: "2026-05-14T16:45:00Z"
	},
	{
		id: "DR-6",
		title: "Board column actions",
		status: "review",
		assignee: "Mika",
		priority: "low",
		region: "ui",
		updated: "2026-05-14T11:00:00Z"
	},
	{
		id: "DR-7",
		title: "Refresh on data change",
		status: "backlog",
		assignee: "Sam",
		priority: "medium",
		region: "renderer",
		updated: "2026-05-13T08:20:00Z"
	},
	{
		id: "DR-8",
		title: "Storybook smoke test",
		status: "in-progress",
		assignee: "Aure",
		priority: "low",
		region: "ui",
		updated: "2026-05-12T14:30:00Z"
	}
].map(({ id: e, title: t, status: n, assignee: r, priority: i, region: a, updated: o }) => ({
	id: e,
	title: t,
	attributes: {
		status: n,
		assignee: r,
		priority: i,
		region: a,
		updated: o
	}
})), Ce = [
	"gray",
	"red",
	"orange",
	"yellow",
	"green",
	"teal",
	"blue",
	"cyan",
	"purple",
	"pink"
], V = [
	{
		value: "enum",
		label: "Enum"
	},
	{
		value: "enum-multi",
		label: "Enum (multi)"
	},
	{
		value: "string",
		label: "String"
	},
	{
		value: "date",
		label: "Date"
	},
	{
		value: "number",
		label: "Number"
	},
	{
		value: "user",
		label: "User"
	}
], we = [
	{
		id: "filterable",
		label: "Filterable"
	},
	{
		id: "groupable",
		label: "Groupable"
	},
	{
		id: "sortable",
		label: "Sortable"
	},
	{
		id: "displayable",
		label: "Displayable"
	}
], Te = (e) => e.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""), H = (e) => O(e) ? e.getSnapshot() : e, U = (e, t) => {
	if (e && !t.has(e)) return e;
	let n = 2, r = e || "attribute", i = `${r}_${n}`;
	for (; t.has(i);) n += 1, i = `${r}_${n}`;
	return i;
}, W = (e) => e === "enum" || e === "enum-multi" ? {
	kind: e,
	options: [{
		value: "option_1",
		label: "Option 1",
		color: "gray"
	}]
} : { kind: e }, Ee = (t) => {
	let n = t.value ?? "gray";
	return /* @__PURE__ */ D(S.Root, { children: [/* @__PURE__ */ E(S.Trigger, {
		asChild: !0,
		children: /* @__PURE__ */ E(b, {
			"aria-label": "Pick color",
			variant: "ghost",
			size: "2xs",
			children: /* @__PURE__ */ E(y, {
				as: e,
				boxSize: "14px",
				fill: `${n}.500`,
				color: `${n}.500`
			})
		})
	}), /* @__PURE__ */ E(C, { children: /* @__PURE__ */ E(S.Positioner, { children: /* @__PURE__ */ E(S.Content, {
		minW: "140px",
		bg: "bg",
		children: Ce.map((n) => /* @__PURE__ */ E(S.Item, {
			value: n,
			onClick: () => t.onChange(n),
			children: /* @__PURE__ */ D(v, {
				gap: "xs",
				children: [/* @__PURE__ */ E(y, {
					as: e,
					boxSize: "14px",
					fill: `${n}.500`,
					color: `${n}.500`
				}), /* @__PURE__ */ E(T, {
					textStyle: "label/S/regular",
					children: n
				})]
			})
		}, n))
	}) }) })] });
}, De = (e) => {
	let t = V.find((t) => t.value === e.value);
	return /* @__PURE__ */ D(S.Root, { children: [/* @__PURE__ */ E(S.Trigger, {
		asChild: !0,
		children: /* @__PURE__ */ E(_, {
			size: "xs",
			variant: "outline",
			children: t?.label ?? e.value
		})
	}), /* @__PURE__ */ E(C, { children: /* @__PURE__ */ E(S.Positioner, { children: /* @__PURE__ */ E(S.Content, {
		minW: "180px",
		bg: "bg",
		children: V.map((t) => /* @__PURE__ */ E(S.Item, {
			value: t.value,
			onClick: () => e.onChange(t.value),
			children: /* @__PURE__ */ E(T, {
				textStyle: "label/S/regular",
				children: t.label
			})
		}, t.value))
	}) }) })] });
}, Oe = (e) => {
	let r = H(e.options), i = (t, n) => {
		e.onChange(r.map((e, r) => r === t ? {
			...e,
			...n
		} : e));
	}, a = (t) => {
		e.onChange(r.filter((e, n) => n !== t));
	};
	return /* @__PURE__ */ D(w, {
		gap: "2xs",
		children: [
			/* @__PURE__ */ D(v, {
				justifyContent: "space-between",
				children: [/* @__PURE__ */ E(T, {
					textStyle: "label/XS/medium",
					color: "fg.muted",
					children: "Options"
				}), /* @__PURE__ */ D(_, {
					size: "2xs",
					variant: "ghost",
					onClick: () => {
						let t = new Set(r.map((e) => e.value)), n = U(`option_${r.length + 1}`, t);
						e.onChange([...r, {
							value: n,
							label: `Option ${r.length + 1}`,
							color: "gray"
						}]);
					},
					children: [/* @__PURE__ */ E(y, {
						as: t,
						boxSize: "12px"
					}), "Add option"]
				})]
			}),
			r.length === 0 ? /* @__PURE__ */ E(T, {
				textStyle: "label/XS/regular",
				color: "fg.muted",
				children: "No options. Add one above."
			}) : null,
			r.map((e, t) => /* @__PURE__ */ D(v, {
				gap: "2xs",
				children: [
					/* @__PURE__ */ E(Ee, {
						value: e.color,
						onChange: (e) => i(t, { color: e })
					}),
					/* @__PURE__ */ E(x, {
						size: "xs",
						placeholder: "Label",
						value: e.label,
						onChange: (e) => i(t, { label: e.currentTarget.value })
					}),
					/* @__PURE__ */ E(x, {
						size: "xs",
						placeholder: "value",
						value: e.value,
						onChange: (e) => i(t, { value: e.currentTarget.value })
					}),
					/* @__PURE__ */ E(b, {
						"aria-label": "Remove option",
						variant: "destructive-ghost",
						size: "xs",
						onClick: () => a(t),
						children: /* @__PURE__ */ E(y, {
							as: n,
							boxSize: "14px"
						})
					})
				]
			}, t))
		]
	});
}, ke = (e) => {
	let { attribute: t, onChange: r, onRemove: i } = e, a = (e) => {
		e !== t.type.kind && r({
			...t,
			type: W(e)
		});
	}, o = (e) => {
		(t.type.kind === "enum" || t.type.kind === "enum-multi") && r({
			...t,
			type: {
				kind: t.type.kind,
				options: e
			}
		});
	}, s = t.type.kind === "enum" || t.type.kind === "enum-multi", c = s && O(t.type.options);
	return /* @__PURE__ */ D(w, {
		gap: "xs",
		p: "sm",
		borderWidth: "1px",
		borderRadius: "sm",
		bg: "bg.subtle",
		children: [
			/* @__PURE__ */ D(v, {
				gap: "xs",
				align: "center",
				children: [
					/* @__PURE__ */ E(x, {
						size: "sm",
						placeholder: "Label",
						value: t.label,
						onChange: (e) => r({
							...t,
							label: e.currentTarget.value
						})
					}),
					/* @__PURE__ */ E(x, {
						size: "sm",
						placeholder: "id",
						value: t.id,
						onChange: (e) => r({
							...t,
							id: e.currentTarget.value
						})
					}),
					/* @__PURE__ */ E(De, {
						value: t.type.kind,
						onChange: a
					}),
					/* @__PURE__ */ E(b, {
						"aria-label": "Remove attribute",
						variant: "destructive-ghost",
						size: "sm",
						onClick: i,
						children: /* @__PURE__ */ E(y, {
							as: n,
							boxSize: "14px"
						})
					})
				]
			}),
			/* @__PURE__ */ E(v, {
				gap: "md",
				flexWrap: "wrap",
				children: we.map((e) => /* @__PURE__ */ D(v, {
					gap: "2xs",
					children: [/* @__PURE__ */ E(le, {
						size: "sm",
						checked: !!t[e.id],
						onCheckedChange: (n) => r({
							...t,
							[e.id]: n.checked
						})
					}), /* @__PURE__ */ E(T, {
						textStyle: "label/XS/regular",
						color: "fg.muted",
						children: e.label
					})]
				}, e.id))
			}),
			s && c ? /* @__PURE__ */ E(se, {
				variant: "subtle",
				colorPalette: "purple",
				alignSelf: "flex-start",
				children: "Options come from a live source"
			}) : null,
			s && !c ? /* @__PURE__ */ E(Oe, {
				options: t.type.options,
				onChange: o
			}) : null
		]
	});
}, Ae = () => {
	let e = h(B.source.subscribe, B.source.getSnapshot, B.source.getSnapshot), n = (t, n) => {
		B.setAttributes(e.map((e, r) => r === t ? n : e));
	}, r = (t) => {
		B.setAttributes(e.filter((e, n) => n !== t));
	};
	return /* @__PURE__ */ D(ce, {
		maxH: "80vh",
		contentProps: {
			p: "md",
			display: "flex",
			flexDirection: "column",
			gap: "sm"
		},
		children: [
			/* @__PURE__ */ D(v, {
				justifyContent: "space-between",
				children: [/* @__PURE__ */ D(w, {
					gap: "0",
					children: [/* @__PURE__ */ E(T, {
						textStyle: "heading/S/medium",
						children: "Configure attributes"
					}), /* @__PURE__ */ E(T, {
						textStyle: "label/XS/regular",
						color: "fg.muted",
						children: "Add, rename, change kinds, edit enum options. Everything is editable — including removing every attribute."
					})]
				}), /* @__PURE__ */ D(v, {
					gap: "2xs",
					children: [/* @__PURE__ */ E(_, {
						size: "sm",
						variant: "ghost",
						onClick: () => B.setAttributes([]),
						children: "Clear all"
					}), /* @__PURE__ */ D(_, {
						size: "sm",
						variant: "outline",
						onClick: () => {
							let t = new Set(e.map((e) => e.id)), n = {
								id: U(`attribute_${e.length + 1}`, t),
								label: `Attribute ${e.length + 1}`,
								type: W("enum"),
								filterable: !0,
								groupable: !0,
								displayable: !0
							};
							B.setAttributes([...e, n]);
						},
						children: [/* @__PURE__ */ E(y, {
							as: t,
							boxSize: "14px"
						}), "Add attribute"]
					})]
				})]
			}),
			e.length === 0 ? /* @__PURE__ */ E(g, {
				borderWidth: "1px",
				borderRadius: "sm",
				p: "md",
				textAlign: "center",
				children: /* @__PURE__ */ E(T, {
					textStyle: "label/S/regular",
					color: "fg.muted",
					children: "No attributes defined. The renderer will fall back to title-only cards."
				})
			}) : null,
			/* @__PURE__ */ E(w, {
				gap: "sm",
				children: e.map((e, t) => {
					let i = Te(e.label);
					return /* @__PURE__ */ E(ke, {
						attribute: e,
						onChange: (r) => {
							let a = { ...r };
							r.id === e.id && r.label !== e.label && i && !a.id && (a.id = i), n(t, a);
						},
						onRemove: () => r(t)
					}, e.id || `attribute-${t}`);
				})
			})
		]
	});
}, G = "kanban-renderer.story.configureAttributes", je = {
	viewMode: "board",
	columnGrouping: "status",
	rowGrouping: "none",
	displayProperties: [
		"status",
		"assignee",
		"priority"
	]
}, Me = [{
	attributeId: "updated",
	direction: "desc"
}], Ne = (e) => {
	let t = B.getAttributes().find((e) => e.id === "status");
	if (!t || t.type.kind !== "enum") return {
		color: "gray",
		canCreate: !0
	};
	let n = (Array.isArray(t.type.options) ? t.type.options : t.type.options.getSnapshot()).find((t) => t.value === e);
	return n ? {
		color: n.color,
		canCreate: !0
	} : {
		color: "gray",
		canCreate: !0
	};
}, Pe = (e, t, n) => {
	let r = e.find((e) => e.id === t);
	if (!r) return e;
	let i = e.filter((e) => e.id !== t), a = n ? i.findIndex((e) => e.id === n) : -1, o = a === -1 ? i.length : a;
	return [
		...i.slice(0, o),
		r,
		...i.slice(o)
	];
}, Fe = () => {
	let e = Se, t = /* @__PURE__ */ new Set(), n = () => {
		for (let e of t) e();
	};
	return {
		getRows: () => e,
		updateAttribute: (t, r, i) => {
			e = e.map((e) => e.id === t ? {
				...e,
				attributes: {
					...e.attributes,
					[r]: i
				}
			} : e), n();
		},
		reorder: (t, r) => {
			e = Pe(e, t, r), n();
		},
		subscribe: (e) => (t.add(e), () => {
			t.delete(e);
		})
	};
}, Ie = (e) => {
	e.views.registerView({
		id: z,
		title: "Configure attributes",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ E(Ae, {})
		}
	}), e.overlays.registerOverlay({
		id: z,
		viewId: z,
		config: {
			size: "lg",
			placement: "center",
			scrollBehavior: "inside"
		}
	}), e.commands.registerCommand({
		id: G,
		label: "Configure attributes",
		category: "Kanban renderer",
		icon: "settings"
	}, { execute: () => e.overlays.openOverlay(z) }), e.layout.registerMenuItem(s("main"), {
		commandId: G,
		group: "schema",
		order: 10
	});
}, Le = () => ({
	id: "kanban-renderer.story",
	activate(e) {
		let t = Fe();
		e.views.registerView({
			id: R,
			title: "Rows",
			body: {
				kind: "kanban",
				resourceKind: xe,
				toolbarActions: [{
					id: "configure",
					label: "Configure attributes",
					commandId: G,
					presentation: "primary"
				}],
				attributes: B.source,
				defaultSettings: je,
				defaultSorts: Me,
				getBoardColumnConfig: Ne,
				executeQuery: () => t.getRows(),
				subscribe: t.subscribe,
				onAttributeChange: t.updateAttribute,
				onReorder: t.reorder
			}
		}), Ie(e), e.shellPlacements.registerPlacement({
			id: R,
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: R
				}
			},
			region: "main"
		});
	}
}), Re = "import type { ViewSort } from \"@pstdio/sdk/extensions\";\nimport type { KanbanRendererSettings } from \"@pstdio/ui/kanban-renderer\";\nimport { headerTrailingMenuPath, type WorkbenchModuleContext, type WorkbenchModuleContribution } from \"../../core\";\nimport { AttributeEditor } from \"./attribute-editor\";\nimport {\n  kanbanRendererStoryEditorWidgetId,\n  kanbanRendererStoryViewKind,\n  kanbanRendererStoryWidgetId,\n  type StoryRow,\n  storyRows,\n  storySchemaStore,\n} from \"./mock-data\";\n\nconst configureAttributesCommandId = \"kanban-renderer.story.configureAttributes\";\nconst defaultSettings = {\n  viewMode: \"board\",\n  columnGrouping: \"status\",\n  rowGrouping: \"none\",\n  displayProperties: [\"status\", \"assignee\", \"priority\"],\n} satisfies Partial<KanbanRendererSettings>;\nconst defaultSorts: ViewSort[] = [{ attributeId: \"updated\", direction: \"desc\" }];\nconst resolveBoardColumnConfig = (groupKey: string) => {\n  const status = storySchemaStore.getAttributes().find((attribute) => attribute.id === \"status\");\n  if (!status || status.type.kind !== \"enum\") {\n    return { color: \"gray\", canCreate: true };\n  }\n  const options = Array.isArray(status.type.options) ? status.type.options : status.type.options.getSnapshot();\n  const option = options.find((entry) => entry.value === groupKey);\n  if (!option) return { color: \"gray\", canCreate: true };\n  return { color: option.color, canCreate: true };\n};\nconst reorderRows = (items: StoryRow[], rowId: string, beforeRowId?: string) => {\n  const moving = items.find((row) => row.id === rowId);\n  if (!moving) return items;\n  const remaining = items.filter((row) => row.id !== rowId);\n  const beforeIndex = beforeRowId ? remaining.findIndex((row) => row.id === beforeRowId) : -1;\n  const insertIndex = beforeIndex === -1 ? remaining.length : beforeIndex;\n  return [...remaining.slice(0, insertIndex), moving, ...remaining.slice(insertIndex)];\n};\nconst createStoryRowsStore = () => {\n  let rows = storyRows;\n  const listeners = new Set<() => void>();\n  const notify = () => {\n    for (const listener of listeners) listener();\n  };\n  return {\n    getRows: () => rows,\n    updateAttribute: (rowId: string, attributeId: string, value: unknown) => {\n      rows = rows.map((row) =>\n        row.id === rowId ? { ...row, attributes: { ...row.attributes, [attributeId]: value } } : row,\n      );\n      notify();\n    },\n    reorder: (rowId: string, beforeRowId?: string) => {\n      rows = reorderRows(rows, rowId, beforeRowId);\n      notify();\n    },\n    subscribe: (listener: () => void) => {\n      listeners.add(listener);\n      return () => {\n        listeners.delete(listener);\n      };\n    },\n  };\n};\nconst registerSchemaEditor = (ctx: WorkbenchModuleContext) => {\n  ctx.views.registerView({\n    id: kanbanRendererStoryEditorWidgetId,\n    title: \"Configure attributes\",\n    body: {\n      kind: \"react\",\n      render: () => <AttributeEditor />,\n    },\n  });\n  ctx.overlays.registerOverlay({\n    id: kanbanRendererStoryEditorWidgetId,\n    viewId: kanbanRendererStoryEditorWidgetId,\n    config: { size: \"lg\", placement: \"center\", scrollBehavior: \"inside\" },\n  });\n  ctx.commands.registerCommand(\n    {\n      id: configureAttributesCommandId,\n      label: \"Configure attributes\",\n      category: \"Kanban renderer\",\n      icon: \"settings\",\n    },\n    {\n      execute: () => ctx.overlays.openOverlay(kanbanRendererStoryEditorWidgetId),\n    },\n  );\n  ctx.layout.registerMenuItem(headerTrailingMenuPath(\"main\"), {\n    commandId: configureAttributesCommandId,\n    group: \"schema\",\n    order: 10,\n  });\n};\nexport const createKanbanRendererStoryModule = (): WorkbenchModuleContribution => ({\n  id: \"kanban-renderer.story\",\n  activate(ctx) {\n    const rowsStore = createStoryRowsStore();\n    ctx.views.registerView({\n      id: kanbanRendererStoryWidgetId,\n      title: \"Rows\",\n      body: {\n        kind: \"kanban\",\n        resourceKind: kanbanRendererStoryViewKind,\n        toolbarActions: [\n          {\n            id: \"configure\",\n            label: \"Configure attributes\",\n            commandId: configureAttributesCommandId,\n            presentation: \"primary\",\n          },\n        ],\n        attributes: storySchemaStore.source,\n        defaultSettings,\n        defaultSorts,\n        getBoardColumnConfig: resolveBoardColumnConfig,\n        executeQuery: () => rowsStore.getRows(),\n        subscribe: rowsStore.subscribe,\n        onAttributeChange: rowsStore.updateAttribute,\n        onReorder: rowsStore.reorder,\n      },\n    });\n    registerSchemaEditor(ctx);\n    ctx.shellPlacements.registerPlacement({\n      id: kanbanRendererStoryWidgetId,\n      item: {\n        kind: \"view\",\n        presence: \"fixed\",\n        view: {\n          kind: \"view\",\n          id: kanbanRendererStoryWidgetId,\n        },\n      },\n      region: \"main\",\n    });\n  },\n});\n", ze = {
	title: "pstdio-workbench/Reference/Core API/Visual states",
	tags: ["autodocs"],
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "Host API reference for @pstdio/workbench and @pstdio/workbench/react. These APIs build the application shell. Extension authors should use the separate Extension API reference." } }
	}
}, K = c();
K.registerModule(ye());
var Be = l(), q = c();
q.registerModule(ee());
var J = c();
J.registerModule(oe({ createBridgeDocument: ae }));
var Y = c();
Y.registerModule(Le());
var X = c();
X.registerModule(ge());
var Z = c();
Z.registerModule(_e());
var Q = c();
Q.registerModule(p());
var Ve = m(), He = f(), $ = (e, t) => ({ docs: {
	description: { story: e },
	source: {
		code: t,
		language: "tsx",
		type: "code"
	}
} }), Ue = {
	parameters: $("Pages declare the complete set of page-owned placements. Navigation replaces that set atomically.", u),
	render: () => /* @__PURE__ */ E(d, { workbench: Be })
}, We = {
	parameters: $("The smallest complete View and placement registration.", be),
	render: () => /* @__PURE__ */ E(d, { workbench: K })
}, Ge = {
	parameters: $("Every supported workbench placement region. This is an API map, not a suggested product layout.", te),
	render: () => /* @__PURE__ */ E(d, { workbench: q })
}, Ke = {
	parameters: $("A webview with explicit bridge capabilities for commands and artifact access.", ue),
	render: () => /* @__PURE__ */ E(d, { workbench: J })
}, qe = {
	parameters: $("The built-in board renderer driven by an extension-owned schema, query, and mutations.", Re),
	render: () => /* @__PURE__ */ E(d, { workbench: Y })
}, Je = {
	parameters: $("The native file renderer selects an editor or preview from the loaded MIME type.", N),
	render: () => /* @__PURE__ */ E(d, { workbench: X }),
	play: ({ canvasElement: e }) => de(e, X)
}, Ye = {
	parameters: $("A file loader failure is contained in the panel and leaves the rest of the workbench usable.", N),
	render: () => /* @__PURE__ */ E(d, { workbench: Z })
}, Xe = {
	parameters: $("Layout scopes isolate user panel arrangements by project or workspace.", re),
	render: () => /* @__PURE__ */ E(d, { workbench: Ve })
}, Ze = {
	parameters: $("Typed preference schemas drive shared controls, defaults, validation, and scoped storage.", ne),
	render: () => /* @__PURE__ */ E(d, { workbench: Q })
}, Qe = {
	parameters: $("The host provides terminal process operations while the workbench owns the panel UI.", ie),
	render: () => /* @__PURE__ */ E(d, { workbench: He })
};
export { Ke as ArtifactsWebview, Je as FileRenderer, Ye as FileRendererLoadError, We as HelloWorld, Qe as HostTerminal, qe as KanbanRenderer, Xe as LayoutScope, Ue as PageComposition, Ze as PreferenceSchemas, Ge as RegionMap, ze as default };
