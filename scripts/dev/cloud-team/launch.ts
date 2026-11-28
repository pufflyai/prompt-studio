import { readFile } from "node:fs/promises";
import { collectBootstrapFailure } from "./diagnostics";
import { configureActorNetwork, exec, exposeServices, findActor, kube } from "./infra";
import { reserve } from "./operator";
import { until } from "./process";
import { evidence } from "./scenario";
import type { Pair, WorkspaceConfig } from "./types";

type OwnerConfig = Extract<WorkspaceConfig, { role: "owner" }>;
export const createActorLauncher =
  (pair: Pair, ownerConfig: OwnerConfig, minutes: number, save: () => Promise<void>) =>
  async (role: "owner" | "member") => {
    await evidence(pair, `provisioning ${role} Cloud Workspace`);
    // Acquire the companion's real claim; its bounded holder never touches the app's private source root.
    const holder = `exec bun -e 'await Bun.sleep(${minutes * 60_000})' # cloud-team:${pair.id}:${role}`;
    pair.provisioning = { role, command: holder };
    await save();
    const reserved = await reserve(pair, holder, minutes);
    const created = { id: reserved.environmentId };
    pair[role] = { workspaceId: created.id, runId: reserved.runId, pod: "" };
    delete pair.provisioning;
    await save();
    const actor = await findActor(pair, created.id, reserved.runId);
    pair[role] = actor;
    await save();
    await configureActorNetwork(pair, actor, role);
    if (role === "owner") await exposeServices(pair);
    const config: WorkspaceConfig =
      role === "owner"
        ? ownerConfig
        : {
            role,
            managerOrigin: ownerConfig.managerOrigin,
            relayOrigin: ownerConfig.relayOrigin,
            cert: ownerConfig.cert,
            deadline: ownerConfig.deadline,
          };
    await exec(
      pair,
      actor,
      [
        "bun",
        "-e",
        'const fs=await import("node:fs/promises");await fs.mkdir("/workspace/cloud-team",{recursive:true,mode:448});await fs.writeFile("/workspace/cloud-team/config.json",await Bun.stdin.text(),{mode:384});',
      ],
      JSON.stringify(config),
    );
    await exec(
      pair,
      actor,
      [
        "bun",
        "-e",
        `
      const fs=await import("node:fs/promises");
      const bytes=new Uint8Array(await Bun.stdin.arrayBuffer());
      const digest=(await import("node:crypto")).createHash("sha256").update(bytes).digest("hex");
      if(digest!==process.argv[1])throw new Error("Source archive checksum mismatch");
      await fs.rm("/workspace/cloud-team/repo",{recursive:true,force:true});
      await fs.mkdir("/workspace/cloud-team/repo",{recursive:true});
      await fs.writeFile("/workspace/cloud-team/source.tar.gz",bytes,{mode:384});
      const tar=Bun.spawn(["tar","-xzf","/workspace/cloud-team/source.tar.gz","-C","/workspace/cloud-team/repo"],{stdout:"inherit",stderr:"inherit"});
      if(await tar.exited)throw new Error("Source extraction failed");
    `,
        pair.sourceArchiveSha256!,
      ],
      await readFile(`${pair.directory}/source.tar.gz`),
    );
    // Bound the daemon even if its operator disappears. The Job belongs to this exact workspace.
    const pod = JSON.parse(await kube(pair, ["get", "pod", actor.pod, "-o", "json"]));
    const job = pod.metadata.ownerReferences?.find((owner: { kind: string }) => owner.kind === "Job");
    if (!job?.name.startsWith(`pocketcoder-ws-${created.id}`)) throw new Error("Expected owned workspace Job");
    await kube(pair, [
      "patch",
      "job",
      job.name,
      "--type=merge",
      "-p",
      JSON.stringify({ spec: { activeDeadlineSeconds: minutes * 60 } }),
    ]);
    try {
      await exec(pair, actor, ["bun", "/workspace/cloud-team/repo/scripts/dev/cloud-team/bootstrap.ts"]);
      await until(
        `${role} runtime ready`,
        async () => {
          const progress = JSON.parse(
            await exec(pair, actor, [
              "bun",
              "-e",
              `
        const exit=Bun.file("/workspace/cloud-team/exited");
        console.log(JSON.stringify({ready:await Bun.file("/workspace/cloud-team/ready").exists(),
          exit:await exit.exists()?Number(await exit.text()):null}));
      `,
            ]),
          );
          if (progress.exit !== null) throw new Error(`${role} bootstrap exited (${progress.exit})`);
          return progress.ready;
        },
        900,
      );
    } catch (error) {
      await collectBootstrapFailure(pair, actor, role)
        .then((path) => evidence(pair, "startup diagnostics saved", { role, path }))
        .catch((diagnosticError) =>
          evidence(pair, "startup diagnostics unavailable", { role, error: String(diagnosticError) }),
        );
      throw error;
    }
    await evidence(pair, `${role} Cloud workspace ready`, { workspaceId: created.id });
  };
