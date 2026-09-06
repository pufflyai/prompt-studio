/** Host effects run after state commits. A failed effect must not interrupt other owners. */
export function runWorkbenchEffect<Result>(owner: string, effect: () => Result) {
  try {
    return effect();
  } catch (error) {
    console.error(`Workbench effect failed (${owner})`, error);
    return undefined;
  }
}
