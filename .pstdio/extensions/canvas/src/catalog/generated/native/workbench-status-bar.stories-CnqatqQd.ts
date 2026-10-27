// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, t } from "./test-CYwQ_LKY.ts";
import { t as n } from "./workbench-core-N58OeDyx.ts";
import { i as r } from "./workbench-panels-BeesJIZi.ts";
import { t as i } from "./workbench-theme-provider-CQSyY8qK.ts";
import { Box as a, Button as o, Text as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/workbench/workbench-status-bar.stories.tsx
var u = n(), d = (e) => {
	u.views.registerView({
		id: e.id,
		title: e.label,
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ c(s, {
				textStyle: "xs",
				px: "sm",
				children: e.label
			})
		}
	}), u.statusBar.registerItem({
		id: `${e.id}.status-bar-item`,
		viewId: e.id,
		slot: e.slot,
		order: e.order
	});
};
d({
	id: "planner.branch",
	label: "main",
	order: 20,
	slot: "leading"
}), d({
	id: "sync.connection",
	label: "Connected",
	order: 10,
	slot: "leading"
}), d({
	id: "tasks.progress",
	label: "3 tasks",
	order: 10,
	slot: "trailing"
});
var f = "import { Box, Text } from \"@chakra-ui/react\";\nimport { createWorkbench } from \"@pstdio/workbench\";\nimport {\n  WorkbenchStatusBar,\n  WorkbenchThemeProvider,\n} from \"@pstdio/workbench/react\";\n\nconst workbench = createWorkbench();\n\nconst registerItem = (id, label, order, slot) => {\n  workbench.views.registerView({\n    id,\n    title: label,\n    body: { kind: \"react\", render: () => (\n      <Text textStyle=\"xs\" px=\"sm\">{label}</Text>\n    ) },\n  });\n  workbench.statusBar.registerItem({\n    id: id + \".status-bar-item\",\n    viewId: id,\n    slot,\n    order,\n  });\n};\n\nregisterItem(\"planner.branch\", \"main\", 20, \"leading\");\nregisterItem(\"sync.connection\", \"Connected\", 10, \"leading\");\nregisterItem(\"tasks.progress\", \"3 tasks\", 10, \"trailing\");\n\nexport const App = () => (\n  <WorkbenchThemeProvider>\n    <Box h=\"2rem\">\n      <WorkbenchStatusBar workbench={workbench} />\n    </Box>\n  </WorkbenchThemeProvider>\n);", p = {
	title: "pstdio-workbench/Reference/Core API/Status bar",
	component: r,
	tags: ["autodocs"],
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "The host status-bar registry places registered views on its leading or trailing side and centers each item vertically. Extensions reach it through defineStatusBarItem." } }
	}
}, m = {
	args: { workbench: u },
	parameters: { docs: { source: {
		code: f,
		language: "tsx",
		type: "code"
	} } },
	decorators: [(e) => /* @__PURE__ */ c(i, { children: /* @__PURE__ */ c(a, {
		h: "2rem",
		w: "full",
		children: /* @__PURE__ */ c(e, {})
	}) })]
}, h = n();
for (let e of ["Connection", "Performance"]) h.views.registerView({
	id: e,
	title: e,
	body: {
		kind: "react",
		render: () => /* @__PURE__ */ c(s, {
			textStyle: "label/XS",
			px: "xs",
			children: e
		})
	}
}), h.statusBar.registerItem({
	id: e,
	viewId: e,
	slot: "trailing"
});
var g = {
	...m,
	args: { workbench: h },
	parameters: { docs: { description: { story: "Drag a widget directly, like a tab, to reorder it. Focus a widget or its control and use Alt+Left or Alt+Right to reorder with the keyboard. Items keep their leading or trailing slot." } } },
	play: async ({ canvas: n }) => {
		h.statusBar.reorderItem("Connection", { beforeItemId: "Performance" });
		let r = n.getByRole("group", { name: "Connection" });
		r.focus(), await e.keyboard("{Alt>}{ArrowRight}{/Alt}"), await t(h.statusBar.listVisibleItems("trailing").map((e) => e.id)).toEqual(["Performance", "Connection"]), await t(r).toHaveFocus(), await e.keyboard("{Alt>}{ArrowLeft}{/Alt}"), await t(h.statusBar.listVisibleItems("trailing").map((e) => e.id)).toEqual(["Connection", "Performance"]);
	}
}, _ = n();
for (let e of ["leading", "trailing"]) for (let t of ["label", "button"]) {
	let n = `${e}.${t}`;
	_.views.registerView({
		id: n,
		title: n,
		body: {
			kind: "react",
			render: () => t === "label" ? /* @__PURE__ */ l(s, {
				textStyle: "xs",
				px: "sm",
				children: [e, " status"]
			}) : /* @__PURE__ */ l(o, {
				size: "xs",
				variant: "ghost",
				children: [e, " action"]
			})
		}
	}), _.statusBar.registerItem({
		id: n,
		viewId: n,
		slot: e
	});
}
var v = {
	...m,
	args: { workbench: _ },
	parameters: { docs: { description: { story: "Text and buttons in both slots share the vertical center without layout wrappers in the views." } } },
	play: async ({ canvasElement: e }) => {
		let n = e.querySelector("footer");
		if (!n) throw Error("The status bar must be mounted.");
		let r = n.getBoundingClientRect(), i = Number.parseFloat(getComputedStyle(n).borderTopWidth), a = r.top + i + (r.height - i) / 2;
		for (let e of n.querySelectorAll("p, button")) {
			let n = e.getBoundingClientRect();
			await t(Math.abs(n.top + n.height / 2 - a)).toBeLessThan(1);
		}
	}
}, y = n();
y.views.registerView({
	id: "late.item",
	title: "Late item",
	body: {
		kind: "react",
		render: () => /* @__PURE__ */ c(s, {
			textStyle: "xs",
			px: "sm",
			children: "Registered after mount"
		})
	}
}), y.views.registerView({
	id: "first.item",
	title: "First item",
	body: {
		kind: "react",
		render: () => /* @__PURE__ */ c(s, {
			textStyle: "xs",
			px: "sm",
			children: "First item"
		})
	}
}), y.statusBar.registerItem({
	id: "first.item",
	viewId: "first.item",
	slot: "leading"
});
var b = {
	...m,
	args: { workbench: y },
	play: async ({ canvas: e }) => {
		await e.findByText("First item");
		let n = y.statusBar.registerItem({
			id: "late.item",
			viewId: "late.item",
			slot: "trailing"
		});
		await t(await e.findByText("Registered after mount")).toBeVisible(), n.dispose();
	}
};
export { b as ItemRegisteredAfterMount, v as MixedItemHeights, g as ReorderableItems, m as SeveralOwnersInOrder, p as default };
