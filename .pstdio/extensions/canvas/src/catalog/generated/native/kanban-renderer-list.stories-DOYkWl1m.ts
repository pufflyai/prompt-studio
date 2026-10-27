// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./circle-alert-DphG-Ztw.ts";
import { t as i } from "./circle-check-QpR5K4qp.ts";
import { t as a } from "./circle-dashed-B1ik78oL.ts";
import { t as o } from "./circle-dot-DzEudT09.ts";
import { n as s, t as c } from "./signal-DOXfK-K5.ts";
import { t as l } from "./play-crlvkPMv.ts";
import { t as u } from "./kanban-renderer-list-CSW5NN27.ts";
import { useState as d } from "react";
import { Box as f } from "@chakra-ui/react";
import { jsx as p } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-list.stories.tsx
var m = {
	title: "Patterns/Kanban Renderer/List",
	component: u,
	parameters: { layout: "padded" }
}, h = [
	{
		id: "1",
		title: "Review workspace onboarding",
		statusIcon: c,
		statusColor: "fg.muted",
		badges: [{
			attributeId: "updated",
			label: "Jan 21"
		}],
		contextMenuActions: [{
			key: "run",
			label: "Run attempt",
			icon: /* @__PURE__ */ p(l, { size: 14 }),
			onClick: () => void 0
		}]
	},
	{
		id: "7",
		title: "Initial worktree setup",
		statusIcon: a,
		badges: [{
			attributeId: "updated",
			label: "Feb 17"
		}]
	},
	{
		id: "8",
		title: "I am parent!",
		statusIcon: s,
		statusColor: "fg.error",
		countBadge: 2,
		countColorPalette: "red",
		badges: [{
			attributeId: "updated",
			label: "Feb 17"
		}],
		children: [{
			id: "9",
			title: "child task",
			statusIcon: a,
			badges: [{
				attributeId: "updated",
				label: "Feb 18"
			}]
		}, {
			id: "10",
			title: "another child",
			statusIcon: a,
			badges: [{
				attributeId: "updated",
				label: "Mar 7"
			}]
		}]
	},
	{
		id: "2",
		title: "Set up your teams",
		statusIcon: i,
		statusColor: "fg.success",
		badges: [{
			attributeId: "updated",
			label: "Jan 21"
		}]
	},
	{
		id: "5",
		title: "Add label support",
		statusIcon: i,
		statusColor: "fg.success",
		badges: [{
			attributeId: "labels",
			label: "test",
			color: "purple"
		}, {
			attributeId: "updated",
			label: "Feb 6"
		}]
	}
], g = { args: { items: h } }, _ = () => {
	let [e, t] = d(null);
	return /* @__PURE__ */ p(u, {
		items: h,
		selectedItemId: e,
		onItemClick: (e) => t(e.id)
	});
}, v = { render: () => /* @__PURE__ */ p(_, {}) }, y = { args: { items: [{
	id: "1",
	title: "Implement authentication flow",
	statusIcon: o,
	statusColor: "fg.success",
	badges: [{
		attributeId: "priority",
		label: "high",
		color: "red",
		icon: "alert-triangle"
	}, {
		attributeId: "component",
		label: "backend",
		color: "blue",
		icon: "tag"
	}]
}, {
	id: "2",
	title: "Fix login redirect loop",
	statusIcon: r,
	statusColor: "fg.error",
	badges: [{
		attributeId: "labels",
		label: "bug",
		color: "red",
		icon: "bug"
	}]
}] } }, b = { args: { items: [] } }, x = { args: { items: [{
	id: "p1",
	title: "Top-level parent",
	statusIcon: a,
	children: [{
		id: "c1",
		title: "Child task",
		statusIcon: a,
		children: [{
			id: "gc1",
			title: "Grandchild task",
			statusIcon: i,
			statusColor: "fg.success"
		}]
	}, {
		id: "c2",
		title: "Another child",
		statusIcon: a
	}]
}] } }, S = {
	tags: ["!manifest"],
	args: { items: Array.from({ length: 1e3 }, (e, t) => ({
		id: `row-${t}`,
		eyebrow: `PS-${t + 1}`,
		title: `Ticket ${t + 1}`,
		statusIcon: a,
		badges: [{
			attributeId: "updated",
			label: "Oct 19"
		}],
		contextMenuActions: [{
			key: "open",
			label: "Open ticket",
			onClick: () => void 0
		}]
	})) },
	decorators: [(e) => /* @__PURE__ */ p(f, {
		height: "600px",
		display: "flex",
		flexDirection: "column",
		children: /* @__PURE__ */ p(e, {})
	})],
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await n(await i.findByText("Ticket 1", { exact: !0 })).toBeVisible(), n(i.getAllByText(/^Ticket \d+$/).length).toBeLessThan(60);
		let a = i.getByRole("option", { name: /Ticket 1\b/ });
		a.focus();
		let o = i.getByLabelText("Collection list");
		o.scrollTop = o.scrollHeight, await t(() => n(i.getByText("Ticket 1000", { exact: !0 })).toBeVisible()), n(a).toHaveFocus(), n(i.getAllByText(/^Ticket \d+$/).length).toBeLessThan(60);
	}
};
export { x as DeepNesting, g as Default, b as Empty, v as Interactive, S as LargeList, y as WithBadges, m as default };
