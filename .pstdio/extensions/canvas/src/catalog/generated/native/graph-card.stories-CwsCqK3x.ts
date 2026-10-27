// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./graph-card-CCSH6w7n.ts";
import { n as t } from "./planner-Bje3Dhof.ts";
import { t as n } from "./ticket-board-Clw0UQea.ts";
import { useState as r } from "react";
import { Box as i } from "@chakra-ui/react";
import { jsx as a } from "react/jsx-runtime";
import { createWebviewClient as o, workbenchPages as s } from "@pstdio/sdk/extensions";
// extensions/pstdio-planner/src/timeline/view/graph-card.story-fixture.tsx
var c = {
	id: "preview-review",
	ticketId: "shared-card",
	title: "Check the preview",
	instructions: "Confirm the result.",
	request: { kind: "task" },
	requestedAt: "2026-10-20T09:00:00.000Z",
	requestedBy: {
		type: "agent",
		id: "agent",
		displayName: "Agent"
	},
	context: {
		reason: null,
		workspaceId: null,
		attemptRevision: null,
		sessionId: "chat",
		relatedSessionId: null
	},
	state: "open",
	outcome: null,
	outcomeText: null
};
function l(t) {
	let { displayProperties: i = n, ...c } = t, [l, u] = r({
		status: t.row.status?.id,
		type: "feature"
	}), [d] = r(() => ({
		extensionId: "pstdio.pstdio-planner",
		call: (async (e, t) => {
			if (e === "resources.actions") return [{
				key: "run",
				label: "Run attempt",
				icon: "Play"
			}];
			if (e === "commands.execute") {
				let { params: e } = t;
				return u((t) => ({
					...t,
					[String(e?.attributeId)]: e?.value
				})), { outcome: {
					ok: !0,
					status: "success",
					value: null
				} };
			}
		}),
		onEvent: () => () => {}
	})), f = {
		id: t.row.id,
		title: t.row.title,
		attributes: {
			...l,
			workspace: "workspace",
			workspaceItems: [{
				id: "workspace",
				label: "P-1_A1",
				target: {
					kind: "page",
					page: s.workspace,
					resource: {
						type: "workspace",
						id: "workspace"
					}
				}
			}]
		},
		resource: {
			type: "ticket",
			id: t.row.id
		}
	};
	return /* @__PURE__ */ a(e, {
		...c,
		interaction: {
			host: d,
			client: o(d),
			rows: /* @__PURE__ */ new Map([[f.id, f]]),
			attributes: [
				{
					id: "workspace",
					label: "Workspace",
					type: { kind: "string" },
					displayable: !0,
					display: {
						kind: "badge-list",
						itemsAttributeId: "workspaceItems"
					}
				},
				{
					id: "status",
					label: "Status",
					editable: !0,
					displayable: !0,
					type: {
						kind: "enum",
						options: [{
							value: t.row.status?.id ?? "todo",
							label: t.row.status?.name ?? "Todo"
						}, {
							value: "done",
							label: "Done"
						}]
					}
				},
				{
					id: "type",
					label: "Type",
					editable: !0,
					displayable: !0,
					type: {
						kind: "enum",
						options: [{
							value: "feature",
							label: "Feature"
						}, {
							value: "bug",
							label: "Bug"
						}]
					}
				}
			],
			displayProperties: i
		}
	});
}
// extensions/pstdio-planner/src/timeline/view/graph-card.stories.tsx
var u = {
	id: "shared-card",
	shorthand: "P-1",
	title: "Use the same card on both boards",
	status: {
		id: "todo",
		name: "Todo",
		icon: "circle",
		color: "gray"
	},
	state: "not-started",
	done: !1,
	trackId: null,
	deadlineId: null,
	step: 1,
	ancestors: [],
	dependsOn: [],
	blocks: [],
	laterDependencies: [],
	flags: [],
	tagIds: [],
	requests: [],
	requestErrors: [],
	instructions: "",
	target: t({
		id: "shared-card",
		shorthand: "P-1",
		title: "Use the same card on both boards"
	})
}, d = {
	title: "Extensions/Planner/Timeline card",
	component: e,
	render: (e) => /* @__PURE__ */ a(l, { ...e }),
	decorators: [(e) => /* @__PURE__ */ a(i, {
		position: "relative",
		minH: "300px",
		children: /* @__PURE__ */ a(e, {})
	})],
	args: {
		row: u,
		x: 0,
		y: 0,
		dropBefore: !1,
		onSelect: () => {},
		onDragStart: () => {},
		onDragOver: () => {},
		onDrop: () => {}
	}
}, f = {}, p = { args: { row: {
	...u,
	dependsOn: [{
		id: "prerequisite",
		shorthand: "P-2",
		done: !1
	}],
	flags: ["waiting"]
} } }, m = { args: { row: {
	...u,
	state: "blocked",
	flags: ["blocked"],
	blockedReason: "Missing credentials"
} } }, h = { args: { relation: "selected" } }, g = { args: { row: {
	...u,
	status: {
		id: "queued",
		name: "Queued",
		icon: "flag",
		color: "purple"
	}
} } }, _ = { args: { row: {
	...u,
	flags: ["human-needed"],
	state: "await-input",
	requests: [c]
} } }, v = { args: { row: {
	...u,
	state: "input-received",
	requests: [{
		...c,
		state: "answered"
	}]
} } }, y = { render: (e) => /* @__PURE__ */ a(l, {
	...e,
	displayProperties: [
		"id",
		"status",
		"type",
		"workspace",
		"needsAttention"
	]
}) }, b = {
	id: "review",
	ticketId: u.id,
	title: "Review the proposal",
	instructions: "Confirm the scenarios.",
	request: { kind: "task" },
	requestedAt: "2026-10-15T09:00:00.000Z",
	requestedBy: {
		type: "agent",
		id: "agent",
		displayName: "Agent"
	},
	context: {
		reason: null,
		workspaceId: null,
		attemptRevision: null,
		sessionId: "session",
		relatedSessionId: null
	},
	state: "open",
	outcome: null,
	outcomeText: null
}, x = { args: {
	row: {
		...u,
		requests: [b, {
			...b,
			id: "second"
		}],
		state: "await-input"
	},
	onOpenRequests: () => {}
} }, S = { args: {
	row: {
		...u,
		requests: [{
			...b,
			state: "answered",
			outcomeText: "Completion confirmed",
			outcome: {
				kind: "answered",
				at: "2026-10-15T09:10:00.000Z",
				by: {
					type: "human",
					id: "person",
					displayName: "Person"
				},
				response: { confirmed: !0 }
			}
		}]
	},
	onOpenRequests: () => {}
} }, C = { args: { row: {
	...u,
	title: "A longer ticket title keeps the native Kanban card's wrapping and full height, so dependent cards and milestones stay below it."
} } };
export { y as AllProperties, S as AllRequestsResolved, f as Available, m as Blocked, g as CustomStatus, C as FullTitle, x as MultipleRequests, v as ReviewAnswered, _ as ReviewRequested, h as Selected, p as WaitingForPrerequisite, d as default };
