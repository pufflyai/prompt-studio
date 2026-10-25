import {
  createWebviewClient,
  type GuestHost,
  type WebviewCommandsExecuteParams,
  workbenchPages,
} from "@pstdio/sdk/extensions";
import type { ComponentProps } from "react";
import { useState } from "react";
import type { ReviewRequestView } from "../../data/review-request-types";
import { DEFAULT_TIMELINE_DISPLAY_PROPERTIES } from "../../data/ticket-board";
import { plannerExtensionId } from "../planner";
import { GraphCard } from "./graph-card";
import type { PlanClient } from "./use-plan";

export const cardReviewRequest: ReviewRequestView = {
  id: "preview-review",
  ticketId: "shared-card",
  title: "Check the preview",
  instructions: "Confirm the result.",
  request: { kind: "task" },
  requestedAt: "2026-10-20T09:00:00.000Z",
  requestedBy: { type: "agent", id: "agent", displayName: "Agent" },
  context: { reason: null, workspaceId: null, attemptRevision: null, sessionId: "chat", relatedSessionId: null },
  state: "open",
  outcome: null,
  outcomeText: null,
};

interface EditableCardPreviewProps extends ComponentProps<typeof GraphCard> {
  displayProperties?: string[];
}

export function EditableCardPreview(props: EditableCardPreviewProps) {
  const { displayProperties = DEFAULT_TIMELINE_DISPLAY_PROPERTIES, ...cardProps } = props;
  const [values, setValues] = useState<Record<string, unknown>>({ status: props.row.status?.id, type: "feature" });
  const [host] = useState<GuestHost>(() => ({
    extensionId: plannerExtensionId,
    call: (async (method, request) => {
      if (method === "resources.actions") return [{ key: "run", label: "Run attempt", icon: "Play" }];
      if (method === "commands.execute") {
        const { params } = request as WebviewCommandsExecuteParams;
        setValues((current) => ({ ...current, [String(params?.attributeId)]: params?.value }));
        return { outcome: { ok: true, status: "success", value: null } };
      }
    }) as GuestHost["call"],
    onEvent: () => () => {},
  }));
  const source = {
    id: props.row.id,
    title: props.row.title,
    attributes: {
      ...values,
      workspace: "workspace",
      workspaceItems: [
        {
          id: "workspace",
          label: "P-1_A1",
          target: { kind: "page", page: workbenchPages.workspace, resource: { type: "workspace", id: "workspace" } },
        },
      ],
    },
    resource: { type: "ticket", id: props.row.id },
  };
  return (
    <GraphCard
      {...cardProps}
      interaction={{
        host,
        client: createWebviewClient(host) as PlanClient,
        rows: new Map([[source.id, source]]),
        attributes: [
          {
            id: "workspace",
            label: "Workspace",
            type: { kind: "string" },
            displayable: true,
            display: { kind: "badge-list", itemsAttributeId: "workspaceItems" },
          },
          {
            id: "status",
            label: "Status",
            editable: true,
            displayable: true,
            type: {
              kind: "enum",
              options: [
                { value: props.row.status?.id ?? "todo", label: props.row.status?.name ?? "Todo" },
                { value: "done", label: "Done" },
              ],
            },
          },
          {
            id: "type",
            label: "Type",
            editable: true,
            displayable: true,
            type: {
              kind: "enum",
              options: [
                { value: "feature", label: "Feature" },
                { value: "bug", label: "Bug" },
              ],
            },
          },
        ],
        displayProperties,
      }}
    />
  );
}
