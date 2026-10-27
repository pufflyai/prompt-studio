// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./queryClient-BgKKh9f4.ts";
import { t as n } from "./extension-connections-card-QBoz33Jc.ts";
import { jsx as r } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/settings/components/extension-connections-card.stories.tsx
var i = new t({ defaultOptions: { queries: { staleTime: Infinity } } });
i.setQueryData(["extension-connections", "project-1"], { connections: [{
	id: "connection-1",
	extensionId: "pstdio.remote",
	connectionId: "control-plane",
	baseUrl: "https://control.example.test",
	authType: "bearer",
	configured: !0,
	lastCheck: {
		ok: !0,
		status: 200,
		error: null,
		checkedAt: "2026-08-26T08:00:00.000Z"
	},
	updatedAt: "2026-08-26T08:00:00.000Z"
}] });
var a = [{
	id: "pstdio.remote.connection.control-plane",
	localId: "control-plane",
	extensionId: "pstdio.remote",
	label: "Control plane",
	authType: "bearer",
	supportsCheck: !0
}], o = {
	title: "ProjectSettings/ExtensionConnectionsCard",
	component: n,
	parameters: { layout: "padded" },
	decorators: [(t) => /* @__PURE__ */ r(e, {
		client: i,
		children: /* @__PURE__ */ r(t, {})
	})]
}, s = { args: {
	projectId: "project-1",
	definitions: a
} };
export { s as Connected, o as default };
