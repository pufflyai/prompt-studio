// Run the checked-out Prompt Studio build, or open a project with the pinned published CLI.
export const previewCommand = `set -eu
export HOME=/workspace/preview-home
export PSTDIO_HOME="$HOME/.pstdio"
export BUN_INSTALL_BIN="$HOME/.bun/bin"
export PSTDIO_DB_PATH="$PSTDIO_HOME/preview-data"
export PSTDIO_DISABLE_EMBED_MANIFEST=1
mkdir -p "$BUN_INSTALL_BIN"
if test -f packages/pstdio/src/index.ts && test -d packages/pstdio-dashboard; then
  bun install --frozen-lockfile
  bun run build -- --scope pstdio-dashboard --include-dependencies
  pstdio() { bun --conditions=source packages/pstdio/src/index.ts "$@"; }
else
  bun add --global pstdio@0.48.0-nightly.20261118030237
  pstdio() { bun "$BUN_INSTALL_BIN/pstdio" "$@"; }
fi
git init -q
pstdio serve --foreground --host 127.0.0.1 --port 3030 --owner persistent &
preview_pid=$!
trap 'kill "$preview_pid" 2>/dev/null || true' EXIT
bun -e '
const deadline = Date.now() + 240_000;
while (Date.now() < deadline) {
  const runtime = await Bun.file(process.env.PSTDIO_HOME + "/runtime.json").json().catch(() => null);
  if (runtime?.token) {
    const response = await fetch("http://127.0.0.1:3030/readyz", {
      headers: { Authorization: "Bearer " + runtime.token },
    }).catch(() => null);
    if (response?.ok) process.exit(0);
  }
  await Bun.sleep(2000);
}
throw new Error("Prompt Studio did not become ready.");
'
pstdio projects create "PocketCoder preview" --path /workspace/repo
printf 'POCKETCODER_PREVIEW_READY\\n'
wait "$preview_pid"
`;
