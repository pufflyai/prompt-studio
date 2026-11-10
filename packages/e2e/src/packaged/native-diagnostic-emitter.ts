// Observation must never replace the operation or cleanup failure being investigated.
export const createDiagnosticEmitter = (write = (entry: unknown) => console.log(JSON.stringify(entry))) => {
  let enabled = true;
  return (entry: () => unknown) => {
    if (!enabled) return;
    try {
      write(entry());
    } catch (error) {
      enabled = false;
      try {
        console.warn("Native diagnostic recording disabled", String(error));
      } catch {
        // A closed output stream must not affect the scenario either.
      }
    }
  };
};
