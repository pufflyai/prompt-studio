// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-ZX3UlLq0.ts";
import i, { CommandAndMenu as a, t as o } from "./onboarding.stories-B8X6Bf1U.ts";
import { createElement as s } from "react";
import { Fragment as c, jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/core/command-menu.tsx?raw
var d = "import { Button, Stack, Text } from \"@chakra-ui/react\";\nimport {\n  createWorkbench,\n  type WorkbenchPanelRenderInput,\n  workbenchCommandPaletteMenuPath,\n  workbenchTopHeaderTrailingMenuPath,\n} from \"@pstdio/workbench\";\n\nconst panelId = \"host.command-guide\";\nconst placeholderViewId = \"host.command-guide.placeholder\";\nconst openCommandId = \"host.open-command-guide\";\nconst closeCommandId = \"host.close-command-guide\";\nconst panelOpenContextKey = \"host.commandGuideOpen\";\nconst CommandPlaceholder = (props: { input: WorkbenchPanelRenderInput }) => {\n  const { input } = props;\n  return (\n    <Stack h=\"full\" align=\"center\" justify=\"center\" gap=\"sm\" bg=\"bg\">\n      <Stack gap=\"xs\" textAlign=\"center\">\n        <Text textStyle=\"heading/M/semibold\">Nothing is open</Text>\n        <Text color=\"fg.muted\">Run the command to open a panel in Main.</Text>\n      </Stack>\n      <Button onClick={() => void input.workbench.commands.executeCommand(openCommandId)}>Open command panel</Button>\n    </Stack>\n  );\n};\nexport const createCommandWorkbench = () => {\n  const workbench = createWorkbench();\n  workbench.registerModule({\n    id: \"host.command-guide\",\n    activate(ctx) {\n      ctx.views.registerView({\n        id: panelId,\n        title: \"Command guide\",\n        body: {\n          kind: \"react\",\n          render: ({ instance }) => (\n            <Stack h=\"full\" gap=\"sm\" p=\"lg\" bg=\"bg\">\n              <Text textStyle=\"heading/M/semibold\">{instance.title}</Text>\n              <Text color=\"fg.muted\">The placeholder ran a command that opened this panel.</Text>\n            </Stack>\n          ),\n        },\n      });\n      ctx.shellPlacements.registerPlacement({\n        id: panelId,\n        item: {\n          kind: \"view\",\n          presence: \"closed\",\n          view: {\n            kind: \"view\",\n            id: panelId,\n          },\n        },\n        region: \"main\",\n      });\n      ctx.views.registerView({\n        id: placeholderViewId,\n        title: \"Command guide\",\n        body: { kind: \"react\", render: (input) => <CommandPlaceholder input={input} /> },\n      });\n      ctx.placeholders.registerPlaceholder({\n        id: \"host.command-guide.placeholder\",\n        viewId: placeholderViewId,\n        region: \"main\",\n      });\n      ctx.commands.registerCommand(\n        {\n          id: openCommandId,\n          label: \"Open command panel\",\n          category: \"Onboarding\",\n          icon: \"Plus\",\n        },\n        {\n          execute: () => ctx.navigation.openPanel({ panel: { kind: \"shell-placement\", id: panelId } }),\n        },\n      );\n      ctx.commands.registerCommand(\n        {\n          id: closeCommandId,\n          label: \"Close command panel\",\n          category: \"Onboarding\",\n          icon: \"X\",\n        },\n        {\n          execute: () => {\n            const placement = ctx.layout\n              .getLayout()\n              .regions.main.widgets.find((candidate) => candidate.viewId === panelId);\n            if (placement?.placementIdentity?.kind === \"shell\") {\n              ctx.shellPlacements.closePlacement(placement.placementIdentity);\n            }\n          },\n          isEnabled: () => ctx.context.get(panelOpenContextKey) === true,\n        },\n      );\n      ctx.layout.registerMenuItem(workbenchTopHeaderTrailingMenuPath, {\n        commandId: closeCommandId,\n        group: \"primary\",\n      });\n      // The command palette is a menu path like any other menu. Registering an\n      // item makes the command searchable by its label and category.\n      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: openCommandId, order: 10 });\n      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: closeCommandId, order: 11 });\n      const unsubscribe = ctx.layout.store.subscribeSelector(\n        (state) => state.layout.regions.main.widgets.some((widget) => widget.viewId === panelId),\n        (open) => ctx.context.set(panelOpenContextKey, open),\n        { fireImmediately: true },\n      );\n      return { dispose: unsubscribe };\n    },\n  });\n  return workbench;\n};\n";
// packages/pstdio-workbench/src/examples/onboarding/03-command-surface.docs.mdx
function f(t) {
	let i = {
		code: "code",
		h1: "h1",
		h2: "h2",
		li: "li",
		ol: "ol",
		p: "p",
		strong: "strong",
		ul: "ul",
		...t.components
	};
	return u(c, { children: [
		l(n, {
			of: o,
			name: "4. Command and menu"
		}),
		"\n",
		l(i.h1, { children: "4. Let the user open the panel" }),
		"\n",
		u(i.p, { children: [
			"Commands own behavior. The placeholder button, the header menu item, and the command palette all expose the same\ncommands without copying their handlers. This story uses Core API commands and a host menu; extension commands use\n",
			l(i.code, { children: "defineCommand" }),
			" instead."
		] }),
		"\n",
		l(i.p, { children: "Try it in the story:" }),
		"\n",
		u(i.ol, { children: [
			"\n",
			u(i.li, { children: [
				"Press ",
				l(i.strong, { children: "Open command panel" }),
				" inside the placeholder. The command opens a real panel through the navigation executor\nand the placeholder disappears."
			] }),
			"\n",
			u(i.li, { children: [
				"Press ",
				l(i.strong, { children: "Close command panel" }),
				" in the header to close the panel and reveal the placeholder again. The close command\nis disabled while there is no panel to close."
			] }),
			"\n",
			u(i.li, { children: [
				"Open the command palette (",
				l(i.code, { children: "Mod+P" }),
				", then type ",
				l(i.code, { children: ">" }),
				"), search for \"Open command panel\" or \"Close command panel\", and\nrun the same commands from there."
			] }),
			"\n"
		] }),
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
		u(i.p, { children: [l(i.code, { children: "ctx.commands.registerCommand(definition, handler)" }), " declares the behavior:"] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "id" }), " is the stable command identity. Menus, keybindings, and navigation actions refer to this value."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "label" }), " is the user-facing name. The command palette matches against it."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "category" }), " groups related commands. The palette shows it as a prefix, so \"Onboarding: Open command panel\" is\nsearchable by either part."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "icon" }), " names the glyph menus and palette rows display."] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "execute" }),
				" runs the behavior. Opening a placement goes through ",
				l(i.code, { children: "ctx.navigation.openPanel(...)" }),
				", the same executor\nevery other caller uses."
			] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "isEnabled" }), " gates the command. A disabled command renders greyed out in menus and the palette and cannot run."] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [l(i.code, { children: "ctx.layout.registerMenuItem(path, item)" }), " exposes a command in one surface:"] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "workbenchTopHeaderTrailingMenuPath" }), " places the item in the header's trailing menu."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "workbenchBreadcrumbLocationMenuPath" }), " places a location action, such as Copy link, in the breadcrumb menu on every\npage. It follows the page resource's own actions. Resource rows in trees do not show it."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "workbenchCommandPaletteMenuPath" }), " places the item in the command palette. The palette is a menu path like any other\nmenu: registering an item there makes the command searchable by label and category. Commands never appear in the\npalette automatically."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "commandId" }), " names the command the item runs."] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "order" }),
				" sorts items inside one menu group; ",
				l(i.code, { children: "group" }),
				" selects the group."
			] }),
			"\n"
		] }),
		"\n",
		l(i.p, { children: "The context key wiring keeps the close command honest:" }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "ctx.layout.store.subscribeSelector(...)" }), " watches whether the panel is open."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "ctx.context.set(panelOpenContextKey, open)" }), " publishes that state as a context key."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "isEnabled" }), " reads the key, so both the header item and the palette row disable together."] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [
			"A keybinding can run the same command by declaring ",
			l(i.code, { children: "action: { kind: \"command\", commandId }" }),
			". Keybindings, menu items,\npalette rows, and buttons stay thin: the command is the single owner of the behavior."
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
