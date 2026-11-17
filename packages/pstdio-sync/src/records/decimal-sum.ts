/** Sum the decimal representation written to JSON, then round once at the public boundary. */
export const createDecimalSum = () => {
  let units = 0n;
  let scale = 0;
  return {
    add(value: number) {
      const [coefficient, exponent = "0"] = String(value).split("e");
      const [integer, fraction = ""] = coefficient.split(".");
      let nextUnits = BigInt(integer + fraction);
      let nextScale = fraction.length - Number(exponent);
      if (nextScale < 0) {
        nextUnits *= 10n ** BigInt(-nextScale);
        nextScale = 0;
      }
      if (nextScale > scale) {
        units *= 10n ** BigInt(nextScale - scale);
        scale = nextScale;
      } else nextUnits *= 10n ** BigInt(scale - nextScale);
      units += nextUnits;
    },
    value() {
      const result = Number(`${units}e-${scale}`);
      if (!Number.isFinite(result)) throw new Error("Aggregate number exceeds the finite JavaScript range");
      return result;
    },
  };
};
