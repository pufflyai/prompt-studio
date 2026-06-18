// Bun can initialize Lexical peer packages concurrently during tests, which trips
// @lexical/markdown's circular references. Load the peers first in a stable order.
import "lexical";
import "@lexical/utils";
import "@lexical/list";
import "@lexical/rich-text";
import "@lexical/code";
import "@lexical/link";
