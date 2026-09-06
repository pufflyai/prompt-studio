import { describe, expect, test } from "bun:test";
import { type CommandFilesParamValue, createCommandFilesParamValue } from "@pstdio/workbench/react";
import { prepareExtensionCommandArgs } from "./extension-command-handler";

const input = { projectId: "project-1", commandId: "extension.command.upload" };

describe("extension command file arguments", () => {
  test("uploads files in order and preserves existing refs and other arguments", async () => {
    const uploaded: string[] = [];
    const args = {
      ticket: "PS-1",
      files: createCommandFilesParamValue({
        refs: ["existing"],
        uploads: ["first", "second"].map((id) => ({
          id,
          file: new File([id], `${id}.csv`),
          status: "queued" as const,
        })),
      }),
    };
    const prepared = await prepareExtensionCommandArgs({
      ...input,
      args,
      uploadFile: async (_projectId, _commandId, file) => {
        uploaded.push(file.name);
        return { id: `ref-${file.name}` };
      },
    });
    expect(uploaded).toEqual(["first.csv", "second.csv"]);
    expect(prepared).toEqual({ ticket: "PS-1", files: ["existing", "ref-first.csv", "ref-second.csv"] });
  });

  test("reuses completed uploads after a later upload fails", async () => {
    const reports: CommandFilesParamValue[] = [];
    let attempts = 0;
    const uploadFile = async (_projectId: string, _commandId: string, file: File) => {
      attempts++;
      if (file.name === "second.csv" && attempts === 2) throw new Error("upload failed");
      return { id: `ref-${file.name}` };
    };
    const files = createCommandFilesParamValue({
      uploads: ["first", "second"].map((id) => ({
        id,
        file: new File([id], `${id}.csv`),
        status: "queued" as const,
      })),
    });
    await expect(
      prepareExtensionCommandArgs({
        ...input,
        args: { files },
        uploadFile,
        onArgsChange: (args) => reports.push((args as { files: CommandFilesParamValue }).files),
      }),
    ).rejects.toThrow("upload failed");
    expect(reports.at(-1)?.uploads.map((upload) => upload.status)).toEqual(["complete", "error"]);
    const prepared = await prepareExtensionCommandArgs({ ...input, args: { files: reports.at(-1) }, uploadFile });
    expect(prepared).toEqual({ files: ["ref-first.csv", "ref-second.csv"] });
    expect(attempts).toBe(3);
  });
});
