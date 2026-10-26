import type { HttpClient } from "isomorphic-git";
import webHttp from "isomorphic-git/http/web";

// Only the fixture server runs Git. Installers run in a separate process with an empty PATH.
export const serveExtensionRepository = (repo: string) => {
  const git = Bun.which("git");
  if (!git) throw new Error("The repository fixture requires Git");
  const calls: string[] = [];
  const errors: string[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      calls.push(request.method);
      const advertise = request.method === "GET";
      const child = Bun.spawn(
        [git, "upload-pack", "--stateless-rpc", ...(advertise ? ["--advertise-refs"] : []), repo],
        { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
      );
      if (!advertise) child.stdin.write(new Uint8Array(await request.arrayBuffer()));
      child.stdin.end();
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).arrayBuffer(),
        new Response(child.stderr).text(),
      ]);
      if (exitCode !== 0) {
        errors.push(stderr);
        return new Response(stderr, { status: 500 });
      }
      const service = "# service=git-upload-pack\n";
      return new Response(
        advertise
          ? Buffer.concat([
              Buffer.from(`${(service.length + 4).toString(16).padStart(4, "0")}${service}0000`),
              Buffer.from(stdout),
            ])
          : stdout,
        { headers: { "content-type": `application/x-git-upload-pack-${advertise ? "advertisement" : "result"}` } },
      );
    },
  });
  const http: HttpClient = {
    request: (request) => {
      const url = new URL(request.url);
      return webHttp.request({ ...request, url: new URL(url.pathname + url.search, server.url).href });
    },
  };
  return { calls, errors, http, server };
};
