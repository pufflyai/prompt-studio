// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { n as r, t as i } from "./workbench-core-kaLFKJEn.ts";
import { t as a } from "./controls-view-ywasq8Ff.ts";
import { t as o } from "./kanban-view-B87ekQKc.ts";
import { t as s } from "./workbench-theme-provider-CQSyY8qK.ts";
import { t as c } from "./file-renderer-view-BbUfkXgr.ts";
import { useState as l } from "react";
import { Box as u, Button as d, Stack as f } from "@chakra-ui/react";
import { jsx as p, jsxs as m } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/renderer-rebinding.stories.tsx
var h = () => {
	let [e] = l(() => {
		let e = i(), t = Promise.withResolvers(), n = r(e);
		return n.registerControlsRenderer({
			id: "controls",
			title: "Resource controls",
			executeQuery: async (e) => (e?.id === "second" && await t.promise, {
				params: [{
					id: "name",
					name: "Resource name",
					type: "text",
					defaultValue: ""
				}],
				values: { name: e?.id ?? "" }
			}),
			apply: () => {}
		}), {
			workbench: e,
			pending: t,
			contribution: n.getControlsRenderer("controls")
		};
	}), [t, n] = l("first");
	return /* @__PURE__ */ m(f, {
		gap: "md",
		children: [
			/* @__PURE__ */ p(d, {
				onClick: () => n("second"),
				children: "Select second resource"
			}),
			/* @__PURE__ */ p(d, {
				onClick: () => e.pending.resolve(),
				children: "Finish loading"
			}),
			/* @__PURE__ */ p(u, {
				height: "sm",
				children: /* @__PURE__ */ p(a, {
					workbench: e.workbench,
					contribution: e.contribution,
					placement: {
						instanceId: "controls",
						panelId: "controls",
						closable: !1,
						resource: {
							type: "document",
							id: t
						}
					}
				})
			})
		]
	});
}, g = () => {
	let [e] = l(() => {
		let e = i(), t = r(e), n, a = (e) => (n?.dispose(), n = t.registerFileRenderer({
			id: "file",
			title: "File",
			load: () => ({
				fileName: "readme.md",
				content: e
			})
		}), t.getFileRenderer("file"));
		return {
			workbench: e,
			renderers: t,
			register: a,
			contribution: a("Old contribution")
		};
	}), [t, n] = l(e.contribution);
	return /* @__PURE__ */ m(f, {
		gap: "md",
		children: [
			/* @__PURE__ */ p(d, {
				onClick: () => n(e.register("New contribution")),
				children: "Replace contribution"
			}),
			/* @__PURE__ */ p(d, {
				onClick: () => e.renderers.refreshFileRenderer("file"),
				children: "Refresh file"
			}),
			/* @__PURE__ */ p(u, {
				height: "sm",
				children: /* @__PURE__ */ p(c, {
					workbench: e.workbench,
					contribution: t
				})
			})
		]
	});
}, _ = () => {
	let [e] = l(() => {
		let e = i(), t = Promise.withResolvers(), n = r(e), a = 0;
		return n.registerKanbanRenderer({
			id: "refresh-board",
			title: "Tasks",
			attributes: [{
				id: "title",
				label: "Title",
				type: { kind: "string" },
				sortable: !0
			}],
			defaultSettings: {
				viewMode: "list",
				columnGrouping: "none",
				rowGrouping: "none",
				displayProperties: []
			},
			executeQuery: async () => (a += 1, a === 1 ? [{
				id: "write",
				title: "Write docs",
				attributes: {}
			}] : (await t.promise, [{
				id: "review",
				title: "Review docs",
				attributes: {}
			}]))
		}), {
			workbench: e,
			pending: t,
			contribution: n.getKanbanRenderer("refresh-board")
		};
	});
	return /* @__PURE__ */ m(f, {
		gap: "md",
		children: [/* @__PURE__ */ p(d, {
			onClick: () => e.pending.resolve(),
			children: "Finish loading"
		}), /* @__PURE__ */ p(u, {
			height: "md",
			children: /* @__PURE__ */ p(o, {
				workbench: e.workbench,
				contribution: e.contribution,
				placement: {
					instanceId: "refresh-board",
					panelId: "refresh-board",
					closable: !1
				}
			})
		})]
	});
}, v = {
	title: "Renderers/Rebinding",
	tags: ["!manifest"],
	decorators: [(e) => /* @__PURE__ */ p(s, { children: /* @__PURE__ */ p(e, {}) })]
}, y = {
	render: () => /* @__PURE__ */ p(h, {}),
	play: async ({ canvasElement: r }) => {
		let i = t(r);
		await n(await i.findByRole("textbox")).toHaveValue("first"), await e.click(i.getByRole("button", { name: "Select second resource" })), await n(await i.findByText("Loading…")).toBeVisible(), await n(i.queryByRole("textbox")).not.toBeInTheDocument(), await n(i.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument(), await e.click(i.getByRole("button", { name: "Finish loading" })), await n(await i.findByRole("textbox")).toHaveValue("second");
	}
}, b = {
	render: () => /* @__PURE__ */ p(g, {}),
	play: async ({ canvasElement: r }) => {
		let i = t(r);
		await n(await i.findByText("Old contribution")).toBeVisible(), await e.click(i.getByRole("button", { name: "Replace contribution" })), await e.click(i.getByRole("button", { name: "Refresh file" })), await n(await i.findByText("New contribution")).toBeVisible();
	}
}, x = {
	render: () => /* @__PURE__ */ p(_, {}),
	play: async ({ canvasElement: r }) => {
		let i = t(r);
		await n(await i.findByText("Write docs")).toBeVisible(), await e.click(i.getByRole("button", { name: "Display settings" })), await e.click(await t(document.body).findByRole("button", { name: "Board" })), await e.keyboard("{Escape}"), await n(i.getByText("Write docs")).toBeVisible(), await e.click(i.getByRole("button", { name: "Finish loading" })), await n(await i.findByText("Review docs")).toBeVisible();
	}
};
export { y as ControlsResourceChange, b as FileContributionChange, x as KanbanViewChange, v as default };
