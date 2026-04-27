const KERNEL_RESOURCE_TYPES = new Set(["ticket", "workspace", "session", "project"]);

export type ActivityResourceRef = {
  type: string;
  id: string;
  projectId?: string;
  label?: string;
  extensionId?: string;
  metadata?: Record<string, unknown>;
};

export type ActivityEventRow = {
  id: string;
  project_id: string;
  resource_type: string;
  resource_id: string;
  target_ref_json?: ActivityResourceRef;
  related_refs_json?: ActivityResourceRef[];
  source_extension_id?: string | null;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  source: string;
  summary: string;
  payload_json: Record<string, unknown>;
  created_at: string;
};

export type ActivityFeedItem = {
  id: string;
  title: string;
  resourceType: string;
  resourceId: string;
  resourceLabel: string;
  sourceExtensionId: string | null;
  isKnownKernelResource: boolean;
  createdAt: string;
};

const resolveTargetRef = (event: ActivityEventRow): ActivityResourceRef =>
  event.target_ref_json ?? {
    type: event.resource_type,
    id: event.resource_id,
    projectId: event.project_id,
  };

export const createActivityFeedItem = (event: ActivityEventRow): ActivityFeedItem => {
  const target = resolveTargetRef(event);

  return {
    id: event.id,
    title: event.summary,
    resourceType: target.type,
    resourceId: target.id,
    resourceLabel: target.label ?? target.id,
    sourceExtensionId: event.source_extension_id ?? target.extensionId ?? null,
    isKnownKernelResource: KERNEL_RESOURCE_TYPES.has(target.type),
    createdAt: event.created_at,
  };
};

export const createActivityFeedItems = (events: ActivityEventRow[]) => events.map(createActivityFeedItem);
