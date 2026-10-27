// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./ticket-create-form-CcZ40XLh.ts";
import { KanbanRendererCreateDialog as t } from "@pstdio/ui/kanban-renderer";
// extensions/pstdio-planner/src/ticket-create-form.stories.tsx
var n = {
	title: "Extensions/Planner/Shared Ticket Form",
	component: t
}, r = { args: {
	open: !0,
	columnId: "ready",
	columnAttributeId: "status",
	attributes: [{
		id: "status",
		label: "Status",
		editable: !0,
		type: {
			kind: "enum",
			options: [{
				value: "ready",
				label: "Ready",
				icon: "circle"
			}]
		}
	}],
	config: e((e, t) => t ?? ""),
	onClose: () => {},
	onSubmit: () => {}
} };
export { r as NewTicket, n as default };
