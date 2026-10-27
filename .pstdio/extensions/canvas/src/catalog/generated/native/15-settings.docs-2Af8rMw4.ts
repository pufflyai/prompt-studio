// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-9wQwzhjL.ts";
import i, { Settings as a, t as o } from "./onboarding.stories-B8X6Bf1U.ts";
import { createElement as s } from "react";
import { Fragment as c, jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/settings/module.tsx?raw
var d = "import type { WorkbenchModuleContribution } from \"../../core\";\nimport { createWorkbenchSettingsModule, WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from \"../../react\";\nimport { CustomSettingsPanel } from \"./components/custom-settings-panel\";\nimport { SettingsLauncher } from \"./components/settings-launcher\";\nimport { SnippetEditor } from \"./components/snippet-editor\";\nimport { type DemoSnippet, demoPreferenceSchema, demoSnippets } from \"./demo-settings\";\n\nconst DEMO_PROJECT_ID = \"demo-project\";\nconst LAUNCHER_WIDGET_ID = \"onboarding.settings.launcher\";\nconst LAB_SETTINGS_VIEW_ID = \"onboarding.settings.lab\";\nconst SNIPPET_SETTINGS_VIEW_ID = \"onboarding.settings.snippet\";\n// Shows how a module adds settings entries: declare a preference schema + sections,\n// then register panels (schema, custom, collection). The unified surface module\n// renders the tree + dispatching panel + presenter — no per-page wiring.\nexport const createSettingsModule = (): WorkbenchModuleContribution => ({\n  id: \"onboarding.settings\",\n  activate(ctx) {\n    ctx.preferences.registerSchema(demoPreferenceSchema);\n    ctx.settings.registerSection({ id: \"workbench\", title: \"Workbench\", order: 10 });\n    ctx.settings.registerSection({ id: \"extensions\", title: \"Extensions\", order: 20 });\n    ctx.views.registerView({\n      id: LAB_SETTINGS_VIEW_ID,\n      title: \"Lab settings\",\n      body: { kind: \"react\", render: () => <CustomSettingsPanel /> },\n    });\n    ctx.views.registerView({\n      id: SNIPPET_SETTINGS_VIEW_ID,\n      title: \"Snippet settings\",\n      body: {\n        kind: \"react\",\n        render: (input) => {\n          const panelId = input.instance.resource?.metadata?.panelId;\n          const itemId = input.instance.resource?.metadata?.itemId;\n          const snippet =\n            typeof panelId === \"string\" && typeof itemId === \"string\"\n              ? (input.workbench.settings.getCollectionItem(panelId, itemId) as DemoSnippet | undefined)\n              : undefined;\n          return snippet ? <SnippetEditor snippet={snippet} /> : null;\n        },\n      },\n    });\n    // Schema page (global, live save) — controls auto-generated from the schema.\n    ctx.settings.registerPanel({\n      kind: \"schema\",\n      id: \"appearance\",\n      title: \"Appearance\",\n      section: \"workbench\",\n      scope: \"global\",\n      icon: \"Palette\",\n      description: \"Theme and density — saved per user, applied live.\",\n      preferences: [\n        { name: \"demo.appearance.theme\", label: \"Theme\" },\n        { name: \"demo.appearance.density\", label: \"Density\" },\n        { name: \"demo.appearance.badges\", label: \"Sidenav badges\" },\n      ],\n    });\n    // Schema page (project-scoped, explicit Save/Discard).\n    ctx.settings.registerPanel({\n      kind: \"schema\",\n      id: \"editor\",\n      title: \"Editor\",\n      section: \"workbench\",\n      scope: \"project\",\n      icon: \"PencilRuler\",\n      description: \"Project-scoped editing preferences — staged behind Save.\",\n      save: \"apply\",\n      preferences: [\n        { name: \"demo.editor.fontSize\", label: \"Font size\" },\n        { name: \"demo.editor.wordWrap\", label: \"Word wrap\" },\n        { name: \"demo.editor.rulers\", label: \"Rulers\" },\n      ],\n    });\n    // Custom page — the contributor renders its own component.\n    ctx.settings.registerPanel({\n      kind: \"view\",\n      id: \"lab\",\n      title: \"Lab\",\n      section: \"extensions\",\n      scope: \"global\",\n      icon: \"FlaskConical\",\n      viewId: LAB_SETTINGS_VIEW_ID,\n    });\n    // Collection — per-item nodes grouped by category, each opening an item editor.\n    ctx.settings.registerPanel({\n      kind: \"collection\",\n      viewId: SNIPPET_SETTINGS_VIEW_ID,\n      id: \"snippets\",\n      title: \"Snippets\",\n      section: \"extensions\",\n      scope: \"project\",\n      icon: \"Code\",\n      items: () => demoSnippets.list(),\n      itemId: (item) => item.id,\n      itemLabel: (item) => item.name,\n      groupBy: { key: (item) => item.category, order: [\"Prose\", \"Code\"], label: (key) => key },\n      actions: [\n        {\n          id: \"create\",\n          label: \"Create snippet\",\n          icon: \"Plus\",\n          run: () => {\n            demoSnippets.create();\n            ctx.settings.refresh();\n          },\n        },\n      ],\n    });\n    // The unified surface renders everything above. Project entries appear because we\n    // resolve a project scope id here.\n    const surface = createWorkbenchSettingsModule({\n      resolveScopeId: (scope) => (scope === \"project\" ? DEMO_PROJECT_ID : undefined),\n    }).activate(ctx);\n    // The surface is a modal overlay; closing it would leave the lesson blank. A main-region\n    // landing widget keeps a way back in by re-running the built-in open command.\n    ctx.views.registerView({\n      id: LAUNCHER_WIDGET_ID,\n      title: \"Settings\",\n      body: { kind: \"react\", render: (input) => <SettingsLauncher input={input} /> },\n    });\n    ctx.shellPlacements.registerPlacement({\n      id: LAUNCHER_WIDGET_ID,\n      item: {\n        kind: \"view\",\n        presence: \"fixed\",\n        view: {\n          kind: \"view\",\n          id: LAUNCHER_WIDGET_ID,\n        },\n      },\n      region: \"main\",\n    });\n    // Open the overlay so the lesson shows the surface immediately.\n    void ctx.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: \"appearance\" });\n    return surface;\n  },\n});\n";
// packages/pstdio-workbench/src/examples/onboarding/15-settings.docs.mdx
function f(t) {
	let i = {
		code: "code",
		h1: "h1",
		h2: "h2",
		li: "li",
		p: "p",
		ul: "ul",
		...t.components
	};
	return u(c, { children: [
		l(n, {
			of: o,
			name: "13. Settings"
		}),
		"\n",
		l(i.h1, { children: "13. Add host settings" }),
		"\n",
		l(i.p, { children: "This Core API example adds settings owned by the host application. A section groups related entries. A panel supplies\neither a preference schema, a custom editor, or a collection-backed editor. The example registers all three panel\nkinds, then opens the settings overlay on the Appearance panel." }),
		"\n",
		l(i.p, { children: "Choose global or project scope based on who owns the value. The host resolves the active scope; the extension should\nnot copy project identity into its settings UI." }),
		"\n",
		l(r, {
			of: a,
			sourceState: "none"
		}),
		"\n",
		l(i.h2, { children: "Complete example" }),
		"\n",
		l(e, {
			code: d,
			language: "tsx"
		}),
		"\n",
		l(i.h2, { children: "What each field means" }),
		"\n",
		l(i.p, { children: "The module declares the data the settings surface renders:" }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "ctx.preferences.registerSchema(...)" }), " registers the named preferences the schema panels edit. Each schema entry\ndeclares the value type, allowed choices, default, and scope."] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "ctx.settings.registerSection({ id, title, order })" }),
				" adds one group in the settings tree. ",
				l(i.code, { children: "order" }),
				" sorts sections;\nlower values sort first. Panels join a section through their ",
				l(i.code, { children: "section" }),
				" field."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [
			l(i.code, { children: "ctx.settings.registerPanel(...)" }),
			" adds one settings page. The ",
			l(i.code, { children: "kind" }),
			" field selects how it renders:"
		] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "kind: \"schema\"" }),
				" auto-generates controls from registered preferences. ",
				l(i.code, { children: "preferences" }),
				" lists each entry as a\npreference ",
				l(i.code, { children: "name" }),
				" plus a user-facing ",
				l(i.code, { children: "label" }),
				"."
			] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "kind: \"view\"" }),
				" renders a registered View instead of generated controls. ",
				l(i.code, { children: "viewId" }),
				" names that View. Use it only when\nthe shared controls cannot represent the setting."
			] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "kind: \"collection\"" }), " renders one tree node per item and opens an item editor View when the user selects a node."] }),
			"\n"
		] }),
		"\n",
		l(i.p, { children: "Fields shared by every panel kind:" }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "id" }), " is the stable panel identity inside the settings surface."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "title" }), " is the label shown in the settings tree."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "section" }), " places the panel under a registered section."] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "scope" }),
				" says who owns the values: ",
				l(i.code, { children: "\"global\"" }),
				" values follow the user, ",
				l(i.code, { children: "\"project\"" }),
				" values belong to one project."
			] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "icon" }), " names the icon shown next to the panel title."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "description" }), " is short helper text shown on the panel."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "save: \"apply\"" }), " stages edits behind an explicit Save action. Without it, edits save live."] }),
			"\n"
		] }),
		"\n",
		l(i.p, { children: "Fields specific to the collection panel:" }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "viewId" }), " names the View that edits one selected item."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "items" }), " returns the current items."] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "itemId" }),
				" and ",
				l(i.code, { children: "itemLabel" }),
				" derive each tree node's identity and label from an item."
			] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "groupBy" }),
				" groups nodes: ",
				l(i.code, { children: "key" }),
				" picks the group for an item, ",
				l(i.code, { children: "order" }),
				" sorts the groups, and ",
				l(i.code, { children: "label" }),
				" names them."
			] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "actions" }),
				" adds toolbar actions such as Create. Each action has an ",
				l(i.code, { children: "id" }),
				", ",
				l(i.code, { children: "label" }),
				", ",
				l(i.code, { children: "icon" }),
				", and ",
				l(i.code, { children: "run" }),
				" callback."
			] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "ctx.settings.refresh()" }),
				" tells the surface to re-read ",
				l(i.code, { children: "items" }),
				" after data changes."
			] }),
			"\n"
		] }),
		"\n",
		l(i.p, { children: "The item editor View reads its subject from the render input:" }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "input.instance.resource?.metadata" }),
				" carries the ",
				l(i.code, { children: "panelId" }),
				" and ",
				l(i.code, { children: "itemId" }),
				" of the selected collection node."
			] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "input.workbench.settings.getCollectionItem(panelId, itemId)" }), " returns the matching item."] }),
			"\n"
		] }),
		"\n",
		l(i.p, { children: "The host wiring around the panels:" }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "createWorkbenchSettingsModule({ resolveScopeId })" }),
				" activates the unified settings surface: the tree, the\ndispatching panel, and the presenter. ",
				l(i.code, { children: "resolveScopeId" }),
				" maps a scope to a storage key, so project entries appear\nonly when a project scope id resolves."
			] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "ctx.shellPlacements.registerPlacement(...)" }),
				" with ",
				l(i.code, { children: "presence: \"fixed\"" }),
				" keeps a launcher View in the ",
				l(i.code, { children: "main" }),
				" region.\nThe settings surface is a modal overlay, so the launcher gives the user a way back in after closing it."
			] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "ctx.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId })" }), " opens the overlay on one panel."] }),
			"\n"
		] })
	] });
}
function p(e = {}) {
	let { wrapper: t } = e.components || {};
	return t ? l(t, {
		...e,
		children: l(f, { ...e })
	}) : f(e);
}
function m() {
	return s(t, {
		component: p,
		annotations: i
	});
}
export { m as default };
