import { writeFile } from "node:fs/promises";
import { exec } from "./infra";
import type { Actor, Pair } from "./types";

// Capture before cleanup removes the pod; native/operator credentials never enter evidence.
export const collectBootstrapFailure = async (pair: Pair, actor: Actor, role: string) => {
  const result = await exec(pair, actor, [
    "bun",
    "-e",
    `
    const fs=await import("node:fs/promises");
    const config=await Bun.file("/workspace/cloud-team/config.json").json();
    const runtimeFile=Bun.file("/workspace/cloud-team/home/.pstdio/runtime.json");
    const runtime=await runtimeFile.exists()?await runtimeFile.json():{};
    const secrets=[config.key,config.objectKey,config.objectSecret,config.controlToken,config.databaseUrl,runtime.token];
    if(config.databaseUrl)secrets.push(new URL(config.databaseUrl).password);
    const needles=secrets.filter(Boolean).flatMap(secret=>[
      Buffer.from(secret),Buffer.from(JSON.stringify(secret).slice(1,-1))
    ]);
    const overlap=Math.max(0,...needles.map(needle=>needle.byteLength));
    const limit=8*1024*1024;
    const file=Bun.file("/workspace/cloud-team/bootstrap.log");
    const bytes=file.size;
    const start=Math.max(0,bytes-limit-overlap);
    const original=Buffer.from(await file.slice(start,bytes).arrayBuffer());
    const data=Buffer.from(original);
    for(const needle of needles){
      let at=original.indexOf(needle);
      while(at!==-1){
        data.fill(42,at,at+needle.byteLength);
        at=original.indexOf(needle,at+1);
      }
      // A concurrently written log can end partway through a secret.
      for(let length=Math.min(needle.byteLength-1,original.byteLength);length>0;length--){
        if(original.subarray(-length).equals(needle.subarray(0,length))){
          data.fill(42,data.byteLength-length);
          break;
        }
      }
    }
    // Discard any partial secret at the read boundary; replacement preserves byte positions.
    if(start>0)data.fill(42,0,Math.min(overlap,data.byteLength));
    const disk={};
    for(const path of ["/workspace","/tmp"]){
      const stat=await fs.statfs(path);
      disk[path]={totalBytes:stat.blocks*stat.bsize,availableBytes:stat.bavail*stat.bsize};
    }
    console.log(JSON.stringify({bytes,truncated:bytes>limit,log:data.subarray(-limit).toString("utf8"),disk}));
  `,
  ]);
  const path = `${pair.directory}/${role}-bootstrap.json`;
  await writeFile(path, result, { mode: 0o600 });
  return path;
};
