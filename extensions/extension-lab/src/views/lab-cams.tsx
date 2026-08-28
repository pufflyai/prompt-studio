import { Box } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FootagePlayer } from "../components/footage-player";
import { footageArchive } from "../data/footage-archive";
import { useLabHost, useLabHostProps } from "../hooks/host-context";
import { createLabView } from "../renderers/lab-view-shell";

const entryById = (camId: string | undefined) =>
  footageArchive.find((candidate) => candidate.id === camId) ?? footageArchive[0]!;

const camIdFromValue = (value: unknown) => {
  if (value && typeof value === "object" && "camId" in value && typeof value.camId === "string") return value.camId;
  return undefined;
};

// The Cameras tree menu drives this panel: selecting a node runs `cams.select`,
// and the resulting command event carries the new camera id back into the player.
const LabCams = () => {
  const { host } = useLabHost();
  const { lastCommand } = useLabHostProps();
  const [camId, setCamId] = useState(footageArchive[0]!.id);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await host.call<{ outcome: { status: string; value?: unknown } }>("commands.execute", {
        commandId: "pstdio.extension-lab.command.cams.current",
        params: {},
      });
      const current = camIdFromValue(response.outcome.value);
      if (!cancelled && current) setCamId(current);
    })();
    return () => {
      cancelled = true;
    };
  }, [host]);

  useEffect(() => {
    if (
      lastCommand?.commandId !== "pstdio.extension-lab.command.cams.select" ||
      lastCommand.outcome.status !== "success"
    )
      return;
    const selected = camIdFromValue(lastCommand.outcome.value);
    if (selected) setCamId(selected);
  }, [lastCommand]);

  return (
    <Box h="100dvh" minH="0" padding="sm">
      <FootagePlayer entry={entryById(camId)} />
    </Box>
  );
};

export default createLabView(() => <LabCams />);
