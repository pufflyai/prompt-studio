import { expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { acquirePgliteLock } from "./pglite-lock";

const module = new URL("./pglite-lock.ts", import.meta.url).href;
const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-lock-"));

it("denies a second owner and releases its lock idempotently", () => {
  const root = temporary();
  try {
    const database = path.join(root, "database");
    const release = acquirePgliteLock(database);
    expect(() => acquirePgliteLock(database)).toThrow("refusing to open it a second time");
    release();
    release();
    acquirePgliteLock(database)();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it("refuses an existing legacy owner claim", () => {
  const root = temporary();
  try {
    const database = path.join(root, "database");
    fs.mkdirSync(`${database}.lock`);
    fs.writeFileSync(path.join(`${database}.lock`, "owner.active"), "owner");
    expect(() => acquirePgliteLock(database)).toThrow("Stop its runtime");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it("releases ownership when a process is killed", async () => {
  const root = temporary();
  const database = path.join(root, "database");
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      `import {acquirePgliteLock} from ${JSON.stringify(module)}; acquirePgliteLock(process.argv[1]); console.log('ready'); setInterval(()=>{},1000)`,
      database,
    ],
    { stdout: "pipe" },
  );
  try {
    const reader = child.stdout.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain("ready");
    expect(() => acquirePgliteLock(database)).toThrow("refusing to open it a second time");
    child.kill("SIGKILL");
    await child.exited;
    acquirePgliteLock(database)();
  } finally {
    child.kill();
    await child.exited;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it("elects only one owner when processes race for a released lock", async () => {
  const root = temporary();
  const iterations = 150;
  const source = `import fs from 'node:fs'; import path from 'node:path'; import {acquirePgliteLock} from ${JSON.stringify(module)};
    const [root,name,count]=process.argv.slice(1);
    for(let i=0;i<Number(count);i++) {
      const dir=path.join(root,String(i));
      while(!fs.existsSync(path.join(dir,'start'))) await Bun.sleep(1);
      try { const release=acquirePgliteLock(path.join(dir,'database'));
        fs.writeFileSync(path.join(dir,name),'acquired');
        while(!fs.existsSync(path.join(dir,'release'))) await Bun.sleep(1);
        release();
      } catch(error) { fs.writeFileSync(path.join(dir,name),error.message.includes('refusing')?'rejected':error.message); }
    }`;
  const children = ["a", "b"].map((name) =>
    Bun.spawn([process.execPath, "-e", source, root, name, String(iterations)]),
  );
  try {
    for (let index = 0; index < iterations; index++) {
      const directory = path.join(root, String(index));
      fs.mkdirSync(directory);
      acquirePgliteLock(path.join(directory, "database"))();
      fs.writeFileSync(path.join(directory, "start"), "");
      while (!["a", "b"].every((name) => fs.existsSync(path.join(directory, name)))) {
        if (children.some((child) => child.exitCode !== null)) throw new Error("Lock contender exited");
        await Bun.sleep(5);
      }
      const results = ["a", "b"].map((name) => fs.readFileSync(path.join(directory, name), "utf8"));
      fs.writeFileSync(path.join(directory, "release"), "");
      expect(results.sort(), `election ${index}`).toEqual(["acquired", "rejected"]);
    }
    await Promise.all(children.map((child) => child.exited));
  } finally {
    for (const child of children) child.kill();
    await Promise.all(children.map((child) => child.exited));
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
