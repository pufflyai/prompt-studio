interface RendererCommandInput {
  renderer?: {
    resource?: unknown;
  };
}

export const runRendererCommand =
  <TContext, TResult, TInput extends RendererCommandInput>(
    command: { run: (ctx: TContext) => TResult },
    input: TInput,
  ) =>
  (ctx: unknown) =>
    command.run({
      ...(ctx as Record<string, unknown>),
      params: input,
      resource: input.renderer?.resource,
    } as TContext);
