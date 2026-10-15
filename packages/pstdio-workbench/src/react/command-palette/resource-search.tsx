import { Palette } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { WorkbenchCore, WorkbenchResourceSearchRequest } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { WorkbenchPaletteSurface } from "./palette-surface";
import { createWorkbenchResourcePaletteEntries } from "./resource-palette";

interface WorkbenchResourceSearchProps {
  workbench: WorkbenchCore;
  request: WorkbenchResourceSearchRequest;
  onClose(): void;
}

export const WorkbenchResourceSearch = (props: WorkbenchResourceSearchProps) => {
  const { workbench, request, onClose } = props;
  const [search, setSearch] = useState({ request, query: "" });
  const query = search.request === request ? search.query : "";
  if (search.request !== request) setSearch({ request, query: "" });
  const [, refresh] = useState(0);
  useEffect(() => request.subscribe?.(() => refresh((value) => value + 1)), [request]);
  const entries = createWorkbenchResourcePaletteEntries({
    workbench,
    query,
    resources: request.list(query),
    onClose,
  });
  return (
    <WorkbenchPaletteSurface>
      <Palette
        open
        resetKey={request}
        label={request.label}
        entries={entries}
        placeholder={request.placeholder}
        inputIcon={<WorkbenchIcon name="Search" />}
        emptyLabel="No resources found."
        onQueryChange={(query) => setSearch({ request, query })}
        onClose={onClose}
      />
    </WorkbenchPaletteSurface>
  );
};
