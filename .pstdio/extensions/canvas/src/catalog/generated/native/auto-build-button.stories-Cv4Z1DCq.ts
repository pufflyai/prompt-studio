// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./auto-build.story-fixture-B2DuqMiC.ts";
import { t } from "./auto-build-button-_xC8oBDp.ts";
// extensions/pstdio-planner/src/timeline/view/auto-build-button.stories.tsx
var n = {
	title: "Extensions/Planner/Auto Build Status",
	component: t,
	args: {
		enabled: !1,
		sessions: [],
		running: 0,
		capacity: 2,
		configuration: e,
		onPause: async () => !0,
		onResume: async () => !0,
		onStop: async () => !0,
		onOpenSession: () => {},
		t: (e, t) => t ?? e
	}
}, r = {}, i = { args: {
	enabled: !1,
	running: 1,
	supervisor: {
		id: "supervisor",
		title: "Finish PocketCoder 1.0",
		status: "in_progress"
	}
} }, a = { args: { enabled: !0 } }, o = { args: {
	enabled: !0,
	starting: !0
} }, s = { args: {
	enabled: !0,
	matchingTicketCount: 1,
	readyTicketCount: 0,
	waitingTickets: [{
		id: "ticket",
		ticket: "P-1",
		title: "Greeting",
		reason: "existing-attempt",
		dependencyIds: []
	}]
} }, c = { args: {
	...s.args,
	matchingTicketCount: 2,
	readyTicketCount: 1
} }, l = { args: {
	enabled: !0,
	matchingTicketCount: 0
} }, u = { args: {
	enabled: !0,
	running: 2,
	supervisor: {
		id: "supervisor",
		title: "Finish PocketCoder 1.0",
		status: "completed"
	},
	sessions: [{
		id: "ticket",
		title: "PC-103 · Validate worker recovery",
		status: "in_progress"
	}, {
		id: "ticket-2",
		title: "PC-109 · Launch instances from pstdio",
		status: "in_progress"
	}]
} }, d = { args: {
	enabled: !0,
	supervisor: {
		id: "supervisor",
		title: "Auto Build supervisor",
		status: "completed"
	}
} }, f = { args: {
	enabled: !0,
	completed: !0,
	supervisor: {
		id: "supervisor",
		title: "Finish PocketCoder 1.0",
		status: "completed"
	}
} }, p = { args: {
	enabled: !0,
	supervisor: {
		id: "supervisor",
		title: "Finish PocketCoder 1.0",
		status: "queued"
	}
} }, m = { args: {
	enabled: !0,
	supervisor: {
		id: "supervisor",
		title: "Finish PocketCoder 1.0",
		status: "in_progress"
	},
	sessions: [
		"in_progress",
		"awaiting_input",
		"queued",
		"completed",
		"failed",
		"cancelled",
		"disconnected"
	].map((e) => ({
		id: e,
		title: `Ticket · ${e.replaceAll("_", " ")}`,
		status: e
	}))
} }, h = { args: {
	enabled: !0,
	supervisor: {
		id: "supervisor",
		title: "Auto Build supervisor",
		status: "failed"
	}
} }, g = { args: { error: "Agent unavailable" } }, _ = { args: {
	enabled: !0,
	stuck: !0,
	supervisor: {
		id: "supervisor",
		title: "Auto Build supervisor",
		status: "completed"
	}
} }, v = { args: {
	...u.args,
	enabled: !1,
	paused: !0
} }, y = { args: {
	...u.args,
	running: 40,
	capacity: 40,
	sessions: Array.from({ length: 40 }, (e, t) => ({
		id: `agent-${t}`,
		title: `P-${t + 1} · Implement shared tools`,
		status: "in_progress"
	}))
} }, b = { args: {
	...y.args,
	enabled: !1,
	paused: !0
} }, x = { args: {
	...y.args,
	reviewRequests: [{
		id: "release-decision",
		ticketId: "ticket",
		title: "P-1 · Choose the release scope",
		instructions: "Which tool should the builder finish first?",
		request: { kind: "task" },
		requestedAt: "2026-10-22T12:00:00Z",
		requestedBy: {
			type: "agent",
			id: "builder",
			displayName: "Builder"
		},
		context: {
			reason: null,
			workspaceId: null,
			attemptRevision: null,
			sessionId: null,
			relatedSessionId: null
		},
		state: "open",
		outcome: null,
		outcomeText: null
	}],
	onOpenRequest: () => {}
} };
export { f as Completed, s as ExistingWork, h as Failed, y as ManyRunningAgents, l as NoMatchingTickets, r as Off, v as Paused, b as PausedWithManyAgents, p as Queued, c as ReadyAlongsideExistingWork, x as ReviewRequests, u as Running, m as SessionStatuses, d as Sleeping, o as Starting, i as StoppedWithLiveSessions, _ as Stuck, a as Waiting, g as WakeFailed, n as default };
