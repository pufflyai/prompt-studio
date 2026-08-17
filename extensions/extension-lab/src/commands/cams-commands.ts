import { defineCommand, type ExtensionStorageApi, l10n, params } from "@pstdio/sdk/extensions";
import { footageArchive } from "../data/footage-archive";

interface CamSelection {
  camId: string;
}

const camSelection = (storage: ExtensionStorageApi) => storage.collection<CamSelection>("lab-cam-selection");

const selectedCamId = async (storage: ExtensionStorageApi) => {
  const stored = await camSelection(storage).get("current");
  const exists = footageArchive.some((entry) => entry.id === stored?.camId);
  return exists ? stored!.camId : footageArchive[0]!.id;
};

export const camsTreeCommand = defineCommand({
  title: l10n("commands.cams.tree.title", "List Glass Lab cameras"),
  async run(ctx) {
    const selected = await selectedCamId(ctx.storage);
    return [
      {
        id: "cameras",
        label: "Footage archive",
        nodes: footageArchive.map((entry) => ({
          id: entry.id,
          label: entry.label,
          description: entry.camera,
          icon: "video",
          selected: entry.id === selected,
          target: {
            kind: "command",
            command: "extension-lab.cams.select",
            params: { camId: entry.id },
          },
        })),
      },
    ];
  },
});

export const camsSelectCommand = defineCommand({
  title: l10n("commands.cams.select.title", "Select a Glass Lab camera"),
  params: { camId: params.text({ required: true }) },
  async run(ctx) {
    const entry = footageArchive.find((candidate) => candidate.id === ctx.params.camId);
    if (!entry) throw new Error(`Unknown camera: ${ctx.params.camId}`);
    await camSelection(ctx.storage).put("current", { camId: entry.id });
    return { camId: entry.id };
  },
});

export const camsCurrentCommand = defineCommand({
  title: l10n("commands.cams.current.title", "Read the selected Glass Lab camera"),
  async run(ctx) {
    return { camId: await selectedCamId(ctx.storage) };
  },
});
