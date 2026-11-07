import { AlertMessage, Palette, type PaletteEntry } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchActionErrors } from "../notifications/action-errors";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import type { CommandParamEntry } from "./command-palette-params";
import type { CommandParamsRequest } from "./command-params-dialog";
import { WorkbenchPaletteSurface } from "./palette-surface";
import { createResourceParamCommand, queryCommandResources } from "./resource-command-params";
import { createWorkbenchResourcePaletteEntries } from "./resource-palette";

interface ResourceCommandDialogProps {
  workbench: WorkbenchCore;
  request: CommandParamsRequest;
  param: CommandParamEntry;
  onClose(): void;
}
const RESOURCE_PAGE_SIZE = 100;

export const ResourceCommandDialog = (props: ResourceCommandDialogProps) => {
  const [current, setCurrent] = useState({ request: props.request, revision: 0 });
  if (current.request !== props.request) setCurrent({ request: props.request, revision: current.revision + 1 });
  return <ResourceCommandForm key={current.revision} {...props} />;
};

const ResourceCommandForm = ({ workbench, request, param, onClose }: ResourceCommandDialogProps) => {
  const [execution] = useState(() => createResourceParamCommand(workbench, request));
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState({ query: "", limit: RESOURCE_PAGE_SIZE });
  const [resources, setResources] = useState<Awaited<ReturnType<typeof queryCommandResources>>["resources"]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string>();
  const refresh = useWorkbenchStore(workbench.commandPaletteResources.store, (state) => state.refreshToken);
  const providers = useWorkbenchStore(workbench.resources.store, (state) => state.providers);
  useEffect(() => {
    void refresh;
    void providers;
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    void queryCommandResources(workbench, param.resourceType!, search.query, search.limit, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        setResources(result.resources);
        setMore(result.more);
        setLoading(false);
      },
      (caught) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "Could not read resources.");
        setLoading(false);
      },
    );
    return () => controller.abort();
  }, [workbench, param.resourceType, search, refresh, providers]);
  const entries: PaletteEntry[] = createWorkbenchResourcePaletteEntries({
    workbench,
    query: search.query,
    onClose,
    resources: resources.map((entry) => ({
      ...entry,
      activate: async (resource) => {
        setSubmitting(true);
        try {
          return await execution.run(param.key, resource);
        } finally {
          setSubmitting(false);
        }
      },
    })),
  });
  if (more)
    entries.push({
      id: "resource-picker:more",
      label: "More resources",
      searchText: `${search.query} More resources`,
      onActivate: () => {
        if (!loading) setSearch((current) => ({ ...current, limit: current.limit + RESOURCE_PAGE_SIZE }));
      },
    });
  return (
    <WorkbenchPaletteSurface>
      <Palette
        open
        resetKey={request}
        label={request.label}
        entries={entries}
        placeholder="Search resources"
        inputIcon={<WorkbenchIcon name="Search" />}
        footerStart={
          <>
            {error ? <AlertMessage status="error" title={error} role="alert" /> : null}
            <WorkbenchActionErrors workbench={workbench} target="command-palette" />
          </>
        }
        footerEnd={submitting ? <span role="status">Running…</span> : undefined}
        emptyLabel={loading ? "Loading resources…" : "No resources found."}
        onQueryChange={(query) => setSearch({ query, limit: RESOURCE_PAGE_SIZE })}
        onClose={() => {
          if (!execution.pending) onClose();
        }}
      />
    </WorkbenchPaletteSurface>
  );
};
