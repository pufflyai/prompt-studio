// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./performance-popover-content-D6WrD5CF.ts";
import { Box as i } from "@chakra-ui/react";
import { jsx as a } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/performance/components/performance-snapshot.fixtures.ts
var o = (e) => ({
	name: null,
	extensionFrames: [],
	cpuPercent: 0,
	averageCpuPercent: null,
	sustainedHighCpu: !1,
	idleWakeupsPerSecond: 2,
	memoryKiB: {
		workingSet: 82e3,
		peakWorkingSet: 96e3,
		privateBytes: null
	},
	...e
}), s = (e, t, n, r = 1, i = 8e4) => o({
	pid: e,
	role: "extension-frames",
	cpuPercent: n,
	averageCpuPercent: n,
	extensionFrames: Array.from({ length: r }, (e, n) => ({
		installedExtensionId: t,
		webviewId: `view-${n}`
	})),
	memoryKiB: {
		workingSet: i,
		peakWorkingSet: i,
		privateBytes: null
	}
}), c = {
	shader: "Shader Lab",
	motion: "Motion Lab",
	notes: "Notes",
	radar: "Social Radar",
	tickets: "Tickets",
	pencil: "Pencil",
	lab: "Extension Lab",
	font: "Font Editor",
	reports: "Reports",
	artifacts: "Artifacts",
	loops: "Loops",
	glass: "Glass Lab"
}, l = [{
	startedAt: "2026-10-02T12:04:31.000Z",
	durationMs: 182,
	blockingDurationMs: 132,
	scripts: [{
		invokerType: "resolve-promise",
		invoker: "Promise.then",
		source: "index-4f2a.js",
		functionName: "flush",
		durationMs: 160
	}]
}, {
	startedAt: "2026-10-02T12:04:29.000Z",
	durationMs: 96,
	blockingDurationMs: 46,
	scripts: [{
		invokerType: "user-callback",
		invoker: "FrameRequestCallback",
		source: "chat-ui-1c9e.js",
		functionName: "render",
		durationMs: 71
	}]
}], u = [
	60,
	60,
	59,
	60,
	60,
	58,
	60,
	60,
	60,
	57,
	60,
	60,
	60,
	59,
	60,
	60,
	55,
	60,
	60,
	60,
	58,
	60,
	60,
	60,
	59,
	60,
	60,
	57,
	60,
	60
], d = [
	60,
	59,
	60,
	58,
	52,
	44,
	38,
	41,
	47,
	39,
	36,
	44,
	40,
	22,
	28,
	35,
	41,
	38,
	33,
	30,
	36,
	44,
	39,
	31,
	29,
	35,
	38,
	33,
	36,
	34
], f = {
	version: 1,
	host: "desktop",
	capturedAt: "2026-10-02T12:04:32.000Z",
	sampleIntervalMs: 2e3,
	warning: {
		windowMs: 3e4,
		cpuPercent: 80
	},
	measurementWindowMs: 2e3,
	capabilities: {
		processMetrics: !0,
		idleWakeups: !0,
		privateMemory: !1,
		slowFrames: "long-animation-frame"
	},
	processes: [],
	frames: [],
	frameRate: u,
	pausedExtensionIds: []
}, p = [
	o({
		pid: 3,
		role: "gpu",
		cpuPercent: 11
	}),
	o({
		pid: 1,
		role: "main",
		cpuPercent: 1.2
	}),
	o({
		pid: 4,
		role: "utility",
		name: "Network Service",
		cpuPercent: .1
	})
], m = {
	...f,
	processes: [
		o({
			pid: 11,
			role: "workbench",
			cpuPercent: 6,
			averageCpuPercent: 6
		}),
		s(21, "notes", 2, 1, 74e3),
		s(22, "motion", 1, 1, 81e3),
		...p
	]
}, h = {
	...f,
	frameRate: d,
	processes: [
		o({
			pid: 11,
			role: "workbench",
			cpuPercent: 104,
			averageCpuPercent: 104,
			sustainedHighCpu: !0,
			memoryKiB: {
				workingSet: 207e3,
				peakWorkingSet: 24e4,
				privateBytes: null
			}
		}),
		s(23, "shader", 34, 1, 86e3),
		s(22, "motion", 6, 1, 81e3),
		s(21, "notes", 1, 1, 74e3),
		...p
	],
	frames: l
}, g = {
	...f,
	processes: [
		o({
			pid: 11,
			role: "workbench",
			cpuPercent: 8,
			averageCpuPercent: 8
		}),
		s(23, "shader", 27),
		s(24, "radar", 9, 2, 14e4),
		s(25, "tickets", 4, 3, 118e3),
		s(22, "motion", 3),
		s(21, "notes", 2),
		s(26, "pencil", 1),
		s(27, "lab", 1),
		s(28, "font", 1),
		s(29, "reports", 0),
		s(30, "artifacts", 0),
		s(31, "loops", 0),
		s(32, "glass", 0)
	]
}, _ = {
	...f,
	measurementWindowMs: null,
	frameRate: [],
	processes: []
}, v = {
	...f,
	host: "browser",
	sampleIntervalMs: null,
	warning: null,
	measurementWindowMs: null,
	capabilities: {
		processMetrics: !1,
		idleWakeups: !1,
		privateMemory: !1,
		slowFrames: "long-animation-frame"
	},
	frames: [l[1]]
}, y = {
	title: "Settings/Developer tools/Performance popover",
	component: r,
	args: {
		buckets: u,
		paused: /* @__PURE__ */ new Set(),
		openViews: /* @__PURE__ */ new Map(),
		extensionName: (e) => c[e] ?? "Unknown extension",
		onPause: () => void 0,
		onResume: () => void 0
	},
	decorators: [(e) => /* @__PURE__ */ a(i, {
		width: "performance-popover",
		borderWidth: "1px",
		borderColor: "border",
		bg: "bg",
		paddingX: "md",
		paddingY: "sm",
		children: /* @__PURE__ */ a(e, {})
	})]
}, b = { args: { snapshot: m } }, x = { args: {
	snapshot: h,
	buckets: d
} }, S = { args: {
	snapshot: m,
	paused: /* @__PURE__ */ new Set(["shader"])
} }, C = { args: { snapshot: g } }, w = {
	args: { snapshot: g },
	play: async ({ canvasElement: r }) => {
		let i = t(r);
		await e.click(i.getByTestId("performance-more-extensions")), await n(i.getAllByTestId("performance-cpu-row")).toHaveLength(13);
	}
}, T = /* @__PURE__ */ new Map([["notes", 1], ["shader", 1]]), E = { args: {
	snapshot: _,
	buckets: [],
	openViews: T
} }, D = { args: {
	snapshot: void 0,
	error: "Rejected desktop IPC from an untrusted sender",
	openViews: T
} }, O = { args: {
	snapshot: v,
	openViews: T
} }, k = {
	args: { snapshot: {
		...m,
		processes: m.processes.map((e) => e.role === "gpu" ? {
			...e,
			cpuPercent: 92,
			averageCpuPercent: 92,
			sustainedHighCpu: !0
		} : e)
	} },
	play: async ({ canvasElement: e }) => {
		await n(t(e).getByText(/^GPU averaged 92% CPU/)).toBeVisible();
	}
};
export { w as AllExtensions, O as BrowserTab, E as Collecting, D as CpuUnavailable, S as ExtensionPaused, k as GpuBusy, C as ManyExtensions, b as Smooth, x as UnderLoad, y as default };
