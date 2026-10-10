const sameValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

// Release versioning preserves dependency inputs, except the host's compiled CLI packages.
export const isSigningManifest = (before: Record<string, unknown>, after: Record<string, unknown>) => {
  if (sameValue(before, after)) return true;
  if (typeof after.version !== "string" || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(after.version)) return false;
  const previous = { ...before };
  const next = { ...after };
  delete previous.version;
  delete next.version;
  if (!sameValue(previous.optionalDependencies, next.optionalDependencies)) {
    if (before.name !== "pstdio") return false;
    const oldRanges = previous.optionalDependencies as Record<string, unknown> | undefined;
    const newRanges = next.optionalDependencies as Record<string, unknown> | undefined;
    if (!oldRanges || !newRanges || !sameValue(Object.keys(oldRanges).sort(), Object.keys(newRanges).sort()))
      return false;
    for (const [name, range] of Object.entries(newRanges)) {
      if (range === oldRanges[name]) continue;
      if (
        !/^@pstdio\/cli-(darwin|linux|win)-(arm64|x64)$/.test(name) ||
        oldRanges[name] !== before.version ||
        range !== after.version
      )
        return false;
    }
    delete previous.optionalDependencies;
    delete next.optionalDependencies;
  }
  return sameValue(previous, next);
};
