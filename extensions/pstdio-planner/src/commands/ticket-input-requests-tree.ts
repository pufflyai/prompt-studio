import { type ExtensionStorageApi, params, type TreeNode } from "@pstdio/sdk/extensions";
import { inputRequestsCollection } from "../data/attempt-storage";
import type { InputRequestRecord } from "../data/attempt-types";

const emptyInputRequestsNode = (): TreeNode => ({
  id: "input-requests-empty",
  label: "No input requests",
  icon: "Bell",
  disabled: true,
  rowVariant: "empty-state",
});

const resolveInputRequestParams = {
  resolution: params.longText({ label: "Resolution", required: true }),
  completedAction: params.longText({ label: "Completed action", required: true }),
};

const inputRequestNode = (request: InputRequestRecord, projectId: string): TreeNode => ({
  id: `input-request-${request.id}`,
  label: request.question,
  description: request.expectedAction,
  icon: "Bell",
  iconColor: "orange.fg",
  target: {
    kind: "resource",
    resource: {
      type: "session",
      id: request.sessionId,
      projectId,
      label: request.question,
      metadata: { sessionSurface: "side" },
    },
  },
  actions: [
    {
      id: "resolve-input-request",
      label: "Resolve input request",
      icon: "Check",
      command: "pstdio-planner.resolve-input-request",
      params: { requestId: request.id },
      submitLabel: "Resolve",
      input: resolveInputRequestParams,
    },
  ],
});

export const buildInputRequestsSection = async (input: {
  storage: ExtensionStorageApi;
  projectId: string;
  ticketId: string;
}) => {
  const requests = (await inputRequestsCollection(input.storage).list())
    .filter((request) => request.ticketId === input.ticketId && request.state === "open")
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));

  return {
    id: "input-requests",
    label: "Input requests",
    collapsible: true,
    nodes:
      requests.length > 0
        ? requests.map((request) => inputRequestNode(request, input.projectId))
        : [emptyInputRequestsNode()],
  };
};
