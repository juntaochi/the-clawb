/**
 * Lightweight syntax highlighter for Strudel / Hydra code.
 * Zero dependencies. Returns an HTML string with inline color spans.
 * All user-supplied text is HTML-escaped before insertion.
 */

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else",
  "for", "while", "new", "this", "true", "false", "null",
  "undefined", "async", "await", "Math",
]);

// Top-level Strudel + Hydra functions
const BUILTINS = new Set([
  "stack", "note", "s", "sound", "cat", "setcpm",
  "sine", "saw", "rand", "square", "tri",
  "osc", "noise", "src", "shape", "gradient", "solid", "render",
  "a", "o0", "o1", "o2", "o3",
]);

const COLORS: Record<string, string> = {
  comment: "#6272a4",
  string:  "#50fa7b",
  number:  "#f1fa8c",
  keyword: "#ff79c6",
  builtin: "#8be9fd",
  method:  "#bd93f9",
  arrow:   "#ff79c6",
  dot:     "#f8f8f2",
  plain:   "#f8f8f2",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type TokenType = "comment" | "string" | "number" | "keyword" | "builtin" | "method" | "arrow" | "dot" | "plain";

interface Token {
  type: TokenType;
  value: string;
}

export function highlightStrudel(code: string): string {
  const tokens: Token[] = [];
  let i = 0;
  let prevNonSpace: Token | null = null;

  while (i < code.length) {
    const ch = code[i]!;

    // Line comment
    if (ch === "/" && code[i + 1] === "/") {
      const end = code.indexOf("\n", i);
      const val = end === -1 ? code.slice(i) : code.slice(i, end);
      tokens.push({ type: "comment", value: val });
      i += val.length;
      continue;
    }

    // String (single, double, backtick)
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < code.length && code[j] !== ch) {
        if (code[j] === "\\") j++;
        j++;
      }
      tokens.push({ type: "string", value: code.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Arrow =>
    if (ch === "=" && code[i + 1] === ">") {
      tokens.push({ type: "arrow", value: "=>" });
      prevNonSpace = tokens[tokens.length - 1]!;
      i += 2;
      continue;
    }

    // Number (integer or decimal, not preceded by identifier char)
    if (
      /\d/.test(ch) &&
      (i === 0 || /[^a-zA-Z_$]/.test(code[i - 1]!))
    ) {
      let j = i;
      while (j < code.length && /\d/.test(code[j]!)) j++;
      // optional decimal part
      if (
        code[j] === "." &&
        j + 1 < code.length &&
        /\d/.test(code[j + 1]!)
      ) {
        j++;
        while (j < code.length && /\d/.test(code[j]!)) j++;
      }
      tokens.push({ type: "number", value: code.slice(i, j) });
      prevNonSpace = tokens[tokens.length - 1]!;
      i = j;
      continue;
    }

    // Identifier / keyword / builtin / method
    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i;
      while (j < code.length && /[a-zA-Z_$\d]/.test(code[j]!)) j++;
      const word = code.slice(i, j);

      let type: TokenType = "plain";
      if (KEYWORDS.has(word)) {
        type = "keyword";
      } else if (BUILTINS.has(word)) {
        type = "builtin";
      } else if (prevNonSpace?.type === "dot") {
        type = "method";
      }

      const tok: Token = { type, value: word };
      tokens.push(tok);
      prevNonSpace = tok;
      i = j;
      continue;
    }

    // Dot — tracked for method detection on the next identifier
    if (ch === ".") {
      const tok: Token = { type: "dot", value: "." };
      tokens.push(tok);
      prevNonSpace = tok;
      i++;
      continue;
    }

    // Everything else
    const tok: Token = { type: "plain", value: ch };
    tokens.push(tok);
    if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") {
      prevNonSpace = tok;
    }
    i++;
  }

  // Render to HTML
  return tokens
    .map(({ type, value }) => {
      const color = COLORS[type] ?? COLORS.plain;
      if (type === "plain" || type === "dot") return esc(value);
      return `<span style="color:${color}">${esc(value)}</span>`;
    })
    .join("");
}
