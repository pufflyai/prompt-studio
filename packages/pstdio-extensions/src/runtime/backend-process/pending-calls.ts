type Reply = ReturnType<typeof Promise.withResolvers<unknown>>;

/** A reply and any context it carries live only as long as the request's owning invocation. */
export const createPendingCalls = <Context = undefined>() => {
  const invocations = new Map<string, Map<string, Reply & { context: Context }>>();

  const start = (invocationId: string, requestId: string, context: Context) => {
    const entry = { ...Promise.withResolvers<unknown>(), context };
    let calls = invocations.get(invocationId);
    if (!calls) {
      calls = new Map();
      invocations.set(invocationId, calls);
    }
    calls.set(requestId, entry);
    return entry;
  };

  const take = (invocationId: string, requestId: string) => {
    const calls = invocations.get(invocationId);
    const entry = calls?.get(requestId);
    calls?.delete(requestId);
    if (calls?.size === 0) invocations.delete(invocationId);
    return entry;
  };

  const reject = (invocationId: string, error: unknown) => {
    const calls = invocations.get(invocationId);
    invocations.delete(invocationId);
    for (const entry of calls?.values() ?? []) entry.reject(error);
  };

  return {
    start,
    take,
    reject,
    context: (invocationId: string, requestId: string) => invocations.get(invocationId)?.get(requestId)?.context,
  };
};
