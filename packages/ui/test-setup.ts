// Bun can evaluate Lexical's markdown/react packages before their core node exports initialize.
import "lexical";
import "@lexical/code";
import "@lexical/markdown";
import "@lexical/mark";
import "@lexical/react/LexicalTypeaheadMenuPlugin";
