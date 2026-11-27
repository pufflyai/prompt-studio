import { math } from "micromark-extension-math";

type SyntaxExtension = ReturnType<typeof math>;
type TextConstruct = Exclude<NonNullable<SyntaxExtension["text"]>[string], unknown[] | undefined>;
type State = Parameters<TextConstruct["tokenize"]>[1];
type Code = Parameters<State>[0];

const dollar = "$".charCodeAt(0);
const backslash = "\\".charCodeAt(0);
const period = ".".charCodeAt(0);
const openBracket = "[".charCodeAt(0);
const openParenthesis = "(".charCodeAt(0);
const closeBracket = "]".charCodeAt(0);
const closeParenthesis = ")".charCodeAt(0);
const space = " ".charCodeAt(0);
const isDigit = (code: Code) => code !== null && code >= 48 && code <= 57;
const isLineEnding = (code: Code) => code !== null && code >= -5 && code <= -3;

const nativeMath = math();
const nativeInline = nativeMath.text?.[dollar];
if (!nativeInline || Array.isArray(nativeInline)) throw new Error("Markdown's inline math construct is missing");

const decimalAmount: TextConstruct = {
  tokenize(effects, ok, nok) {
    return (code) => {
      if (code !== period) return nok(code);
      effects.consume(code);
      return (next) => (isDigit(next) ? ok(next) : nok(next));
    };
  },
};

const startsMath = (code: Code) => code !== null && /[\p{L}\p{N}\\([\]{_+−-]/u.test(String.fromCharCode(code));

const dollarInline: TextConstruct = {
  ...nativeInline,
  tokenize(effects, ok, nok) {
    const context = this;
    const start = context.now();
    return nativeInline.tokenize.call(context, effects, after, nok);

    function after(code: Code) {
      if (code !== period && !startsMath(code)) return ok(code);
      const source = context.sliceSerialize({ start, end: context.now() });
      if (!/^\$(?:[0-9]|\.[0-9])/.test(source)) return ok(code);
      if (/^\$(?:[0-9]+(?:[.,][0-9]+)*|\.[0-9]+)\$$/.test(source)) return ok(code);

      // A price's dollar can look like a closing math delimiter before the next amount or formula.
      if (code === period) return effects.check(decimalAmount, nok, ok)(code);
      return isDigit(code) || /\s\$$/.test(source) ? nok(code) : ok(code);
    }
  },
};

export const dollarMath: SyntaxExtension = { ...nativeMath, text: { ...nativeMath.text, [dollar]: dollarInline } };

export const legacyInlineMath = (matches: ReadonlyMap<number, number>): SyntaxExtension => ({
  text: {
    [backslash]: {
      name: "legacyInlineMath",
      resolve: nativeInline.resolve,
      tokenize(effects, ok, nok) {
        const context = this;
        const close = matches.get(context.now().offset);
        if (close === undefined) return nok;
        const reachedClose = () => context.now().offset >= close;
        let closingMark: number;
        return start;

        function start(code: Code): ReturnType<State> {
          if (code !== backslash) return nok(code);
          effects.enter("mathText");
          effects.enter("mathTextSequence");
          effects.consume(code);
          return openingMark;
        }

        function openingMark(code: Code): ReturnType<State> {
          if (code !== openBracket && code !== openParenthesis) return nok(code);
          closingMark = code === openBracket ? closeBracket : closeParenthesis;
          effects.consume(code);
          effects.exit("mathTextSequence");
          return between;
        }

        function between(code: Code): ReturnType<State> {
          if (code === null) return nok(code);
          if (reachedClose()) {
            if (code !== backslash || context.now().offset !== close) return nok(code);
            effects.enter("mathTextSequence");
            effects.consume(code);
            return finish;
          }

          const lineEnding = isLineEnding(code);
          const separator = lineEnding ? "lineEnding" : "space";
          if (lineEnding || code === space) {
            effects.enter(separator);
            effects.consume(code);
            effects.exit(separator);
            return between;
          }
          effects.enter("mathTextData");
          return content(code);
        }

        function content(code: Code): ReturnType<State> {
          if (code === null || reachedClose() || code === space || isLineEnding(code)) {
            effects.exit("mathTextData");
            return between(code);
          }
          effects.consume(code);
          return content;
        }

        function finish(code: Code): ReturnType<State> {
          if (code !== closingMark) return nok(code);
          effects.consume(code);
          effects.exit("mathTextSequence");
          effects.exit("mathText");
          return ok;
        }
      },
    },
  },
});
