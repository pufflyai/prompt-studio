import { formatBoundaryResult, verifyBoundaries } from "./boundary-verifier";

const result = verifyBoundaries();
const output = formatBoundaryResult(result);

if (result.errors.length > 0) {
  console.error(output);
  process.exit(1);
}

console.log(output);
