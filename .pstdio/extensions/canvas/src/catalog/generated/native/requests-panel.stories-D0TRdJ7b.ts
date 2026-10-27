// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./requests-panel-BnXYg-9j.ts";
import { n as t } from "./planner-Bje3Dhof.ts";
import { Box as n } from "@chakra-ui/react";
import { jsx as r } from "react/jsx-runtime";
// extensions/pstdio-planner/src/timeline/view/requests-panel.stories.tsx
var i = {
	type: "human",
	id: "person",
	displayName: "Human"
}, a = {
	type: "agent",
	id: "agent",
	displayName: "Agent"
}, o = {
	reason: null,
	workspaceId: null,
	attemptRevision: null,
	sessionId: null,
	relatedSessionId: null
}, s = {
	id: "task",
	ticketId: "ticket",
	title: "Check the preview",
	instructions: "Open the preview and confirm its layout.",
	request: { kind: "task" },
	requestedAt: "2026-10-10T09:00:00.000Z",
	requestedBy: a,
	context: o,
	state: "open",
	outcome: null,
	outcomeText: null
}, c = {
	...s,
	id: "decision",
	title: "Choose the release scope",
	instructions: "Choose the scope and describe any limits.",
	request: {
		kind: "decision",
		questions: [
			{
				id: "scope",
				label: "Release scope",
				required: !0,
				input: {
					kind: "single-choice",
					options: [{
						id: "preview",
						label: "Preview"
					}, {
						id: "full",
						label: "Full release"
					}]
				}
			},
			{
				id: "platforms",
				label: "Platforms",
				required: !1,
				input: {
					kind: "multiple-choice",
					options: [{
						id: "mac",
						label: "macOS"
					}, {
						id: "windows",
						label: "Windows"
					}]
				}
			},
			{
				id: "limits",
				label: "Limits",
				required: !0,
				input: { kind: "text" }
			}
		]
	}
}, l = {
	...s,
	id: "proposal-review",
	title: "Review the note tags proposal",
	instructions: "- **D1.** The sidebar can filter by one tag or by several tags at once.\n- **C1.** A note can have several tags, and tag names ignore case and surrounding spaces.\n- **R1.** Tag edits change a note's modified time, which can reorder recent notes.",
	request: {
		kind: "decision",
		questions: [
			{
				id: "d1-filter",
				label: "D1. How many tags can the sidebar filter by?",
				required: !0,
				input: {
					kind: "single-choice",
					options: [{
						id: "one",
						label: "One tag at a time (recommended)"
					}, {
						id: "many",
						label: "Several tags at once"
					}]
				}
			},
			{
				id: "confirm",
				label: "Tick each assumption you accept",
				required: !1,
				input: {
					kind: "multiple-choice",
					options: [{
						id: "c1",
						label: "C1. A note can have several tags, and names ignore case and spaces"
					}]
				}
			},
			{
				id: "risks",
				label: "Tick each risk you accept",
				required: !1,
				input: {
					kind: "multiple-choice",
					options: [{
						id: "r1",
						label: "R1. Tag edits can reorder recent notes"
					}]
				}
			},
			{
				id: "notes",
				label: "Corrections or other answers",
				required: !1,
				input: { kind: "text" }
			}
		]
	}
}, u = {
	...s,
	id: "handoff",
	title: "PS-32_A1 revision 2 is approved.",
	instructions: "Select, merge, or otherwise handle the approved workspace.",
	request: {
		kind: "decision",
		questions: [{
			id: "result",
			label: "Decision and completed action",
			required: !0,
			input: { kind: "text" }
		}]
	},
	context: {
		...o,
		reason: "approved-revision",
		workspaceId: "workspace",
		attemptRevision: 2
	}
}, d = {
	...s,
	state: "answered",
	outcome: {
		kind: "answered",
		at: "2026-10-10T10:00:00.000Z",
		by: i,
		response: { confirmed: !0 }
	},
	outcomeText: "Completion confirmed"
}, f = {
	...c,
	state: "cancelled",
	outcome: {
		kind: "cancelled",
		at: "2026-10-10T10:00:00.000Z",
		by: i,
		reason: "The release scope changed."
	},
	outcomeText: "Cancelled: The release scope changed."
}, p = {
	...c,
	state: "answered",
	outcome: {
		kind: "answered",
		at: "2026-10-10T10:00:00.000Z",
		by: i,
		response: { answers: {
			scope: "preview",
			platforms: ["mac"],
			limits: "Internal project first."
		} }
	},
	outcomeText: "Release scope: Preview\nPlatforms: macOS\nLimits: Internal project first."
}, m = {
	id: "ticket",
	shorthand: "PS-32",
	title: "Ship the preview",
	status: {
		id: "in-review",
		name: "In Review",
		icon: "eye",
		color: "orange"
	},
	state: "await-input",
	done: !1,
	trackId: null,
	deadlineId: null,
	step: 1,
	ancestors: [],
	dependsOn: [],
	blocks: [],
	laterDependencies: [],
	flags: ["human-needed"],
	tagIds: [],
	requests: [],
	requestErrors: [],
	instructions: "",
	target: t({
		id: "ticket",
		shorthand: "PS-32",
		title: "Ship the preview"
	})
}, h = {
	title: "Extensions/Planner/Needs attention",
	component: e,
	decorators: [(e) => /* @__PURE__ */ r(n, {
		w: "320px",
		p: "md",
		children: /* @__PURE__ */ r(e, {})
	})],
	args: {
		row: m,
		onAnswer: async () => {},
		onOpenChat: async () => {}
	}
}, g = { args: { row: m } }, _ = { args: { row: {
	...m,
	requests: [s]
} } }, v = { args: { row: {
	...m,
	requests: [c]
} } }, y = { args: { row: {
	...m,
	requests: [p]
} } }, b = { args: {
	row: {
		...m,
		requests: [p]
	},
	onAnswer: async () => {
		throw Error("Unable to save. Try again.");
	}
} }, x = { args: { row: {
	...m,
	requests: [l]
} } }, S = { args: { row: {
	...m,
	requests: [u]
} } }, C = { args: { row: {
	...m,
	requests: [d, u]
} } }, w = { args: { row: {
	...m,
	requests: [f]
} } }, T = { args: {
	row: {
		...m,
		requests: [c]
	},
	onAnswer: async () => {
		throw Error("Limits is required.");
	}
} }, E = { args: { row: {
	...m,
	requests: [c]
} } }, D = { args: { row: {
	...m,
	requestErrors: ["Request broken: Request title is required."]
} } };
export { S as AttemptHandoff, w as Cancelled, E as CompleteTicket, v as Decision, y as EditableAnswer, g as NoRequests, C as OpenSiblingAfterAnswer, x as ProposalReview, T as SaveError, _ as Task, D as UnreadableRequest, b as UpdateError, h as default };
