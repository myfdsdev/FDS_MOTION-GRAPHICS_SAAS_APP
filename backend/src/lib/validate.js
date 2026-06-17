// Validation gate for AI-generated Remotion components.
//
// The LLM output is arbitrary code, so before we ever bundle/run it we:
//   1. Strip stray markdown fences the model sometimes adds.
//   2. Parse it (Babel, TS + JSX) — a parse error means it won't compile.
//   3. Walk the AST and REJECT anything outside a strict allowlist:
//      - imports from any module other than "react" / "remotion"
//      - require(), dynamic import()
//      - eval / Function / fetch / XMLHttpRequest / WebSocket
//      - process / fs / child_process / os / path / http(s) / net / dns
//      - window / document / globalThis member access
//   4. Require a default export.
//
// Returns { ok: true, code } or { ok: false, error }.

import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";

// @babel/traverse ships as CJS; the default export is under .default in ESM.
const traverse = _traverse.default || _traverse;

const ALLOWED_IMPORTS = new Set(["react", "remotion"]);

// Pre-built component library shipped in remotion/components. Generated scenes
// live in remotion/scenes, so they reach the library via a "../components"
// relative import. Everything (charts included) is re-exported from the package
// index, but we also allow the "../components/charts" subpath the model may use.
const COMPONENT_LIBRARY_SOURCES = new Set(["../components", "../components/charts"]);
const ALLOWED_LIBRARY_IMPORTS = new Set([
  "TextCard", "StatCard", "ProgressBar", "CalloutBox", "ComparisonCard",
  "CaptionOverlay", "SectionTitle", "StatReveal", "HeroTitle", "ParticleOverlay",
  "AnimeScene", "TerminalScene", "ScreenshotScene", "ProviderChip",
  "BarChart", "LineChart", "PieChart", "KPIGrid",
  // type-only exports
  "ParticleType", "CameraMotion", "AnimeSceneProps", "TerminalStep",
  "ScreenshotStep", "Region", "Point",
]);
const ALLOWED_REMOTION_IMPORTS = new Set([
  "AbsoluteFill",
  "AnimatedImage",
  "Audio",
  "Freeze",
  "Html5Audio",
  "Html5Video",
  "Img",
  "Loop",
  "OffthreadVideo",
  "Sequence",
  "Series",
  "Solid",
  "Video",
  "cancelRender",
  "continueRender",
  "delayRender",
  "getInputProps",
  "useCurrentFrame",
  "useCurrentScale",
  "useDelayRender",
  "useVideoConfig",
  "interpolate",
  "interpolateColors",
  "measureSpring",
  "spring",
  "Easing",
  "random",
  "staticFile",
]);

const BANNED_IDENTIFIERS = new Set([
  "eval", "Function",
  "require",
  "fetch", "XMLHttpRequest", "WebSocket", "EventSource",
  "process", "globalThis", "global",
  "__dirname", "__filename",
]);

const BANNED_GLOBALS_AS_OBJECT = new Set([
  "window", "document", "process", "globalThis", "global", "navigator", "localStorage",
]);

const BANNED_NODE_MODULES = new Set([
  "fs", "node:fs", "child_process", "node:child_process", "os", "node:os",
  "path", "node:path", "http", "node:http", "https", "node:https",
  "net", "node:net", "dns", "node:dns", "crypto", "node:crypto", "vm", "node:vm",
]);

/** Remove ```tsx ... ``` fences and any leading prose before the first import. */
export function stripFences(raw) {
  if (typeof raw !== "string") return "";
  let s = raw.trim();
  const fenced = [...s.matchAll(/```[a-zA-Z]*\s*([\s\S]*?)```/g)]
    .map((m) => m[1].trim())
    .find((block) => /\b(import|export)\b/.test(block));
  if (fenced) s = fenced;
  else {
    // Strip a leading ```lang and trailing ``` if present.
    s = s.replace(/^```[a-zA-Z]*\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  // If the model added prose before the code, cut to the first import/`export`.
  const firstImport = s.indexOf("import ");
  const firstExport = s.indexOf("export ");
  const starts = [firstImport, firstExport].filter((i) => i >= 0);
  if (starts.length) s = s.slice(Math.min(...starts));
  return cleanSingleModule(s.trim());
}

function cleanSingleModule(source) {
  let code = stripDuplicateImports(source);
  code = removeNestedExports(code);
  return trimAfterDefaultExport(code).trim();
}

function stripDuplicateImports(source) {
  const lines = String(source || "").split(/\r?\n/);
  let seenNonImport = false;
  return lines
    .filter((line) => {
      const trimmed = line.trimStart();
      if (/^import\s/.test(trimmed)) {
        if (seenNonImport) return false;
        return true;
      }
      if (trimmed && !trimmed.startsWith("//")) seenNonImport = true;
      return true;
    })
    .join("\n");
}

function removeNestedExports(source) {
  let out = "";
  let depth = 0;
  let i = 0;
  let quote = null;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      out += ch;
      if (ch === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      out += ch;
      if (ch === "*" && next === "/") {
        out += next;
        i += 2;
        inBlockComment = false;
      } else i++;
      continue;
    }
    if (quote) {
      out += ch;
      if (ch === "\\" && i + 1 < source.length) {
        out += source[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }

    if (ch === "/" && next === "/") {
      out += ch + next;
      i += 2;
      inLineComment = true;
      continue;
    }
    if (ch === "/" && next === "*") {
      out += ch + next;
      i += 2;
      inBlockComment = true;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      i++;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") depth = Math.max(0, depth - 1);

    if (depth > 0 && source.slice(i).match(/^export\s+default\s+/)) {
      i += source.slice(i).match(/^export\s+default\s+/)[0].length;
      continue;
    }
    if (depth > 0 && source.slice(i).match(/^export\s+/)) {
      i += source.slice(i).match(/^export\s+/)[0].length;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

function trimAfterDefaultExport(source) {
  const defaultExport = source.match(/\n\s*export\s+default\s+UserComposition\s*;?/);
  if (defaultExport?.index == null) return source;
  const end = defaultExport.index + defaultExport[0].length;
  return source.slice(0, end);
}

function collectNumericConstants(ast) {
  const constants = new Map();
  traverse(ast, {
    VariableDeclarator(p) {
      if (p.parent?.type !== "VariableDeclaration" || p.parent.kind !== "const") return;
      if (p.node.id.type !== "Identifier" || !p.node.init) return;
      const value = evalStaticNumber(p.node.init, constants);
      if (Number.isFinite(value)) constants.set(p.node.id.name, value);
    },
  });
  return constants;
}

function evalStaticNumber(node, constants) {
  if (!node) return null;
  if (node.type === "NumericLiteral") return node.value;
  if (node.type === "Identifier") return constants.has(node.name) ? constants.get(node.name) : null;
  if (node.type === "UnaryExpression") {
    const value = evalStaticNumber(node.argument, constants);
    if (!Number.isFinite(value)) return null;
    if (node.operator === "-") return -value;
    if (node.operator === "+") return value;
    return null;
  }
  if (node.type === "BinaryExpression") {
    const left = evalStaticNumber(node.left, constants);
    const right = evalStaticNumber(node.right, constants);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
    if (node.operator === "+") return left + right;
    if (node.operator === "-") return left - right;
    if (node.operator === "*") return left * right;
    if (node.operator === "/" && right !== 0) return left / right;
    if (node.operator === "%" && right !== 0) return left % right;
    return null;
  }
  if (node.type === "ParenthesizedExpression") {
    return evalStaticNumber(node.expression, constants);
  }
  if (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") {
    return evalStaticNumber(node.expression, constants);
  }
  return null;
}

function evalStaticNumberArray(node, constants) {
  if (!node || node.type !== "ArrayExpression") return null;
  const values = [];
  for (const element of node.elements) {
    if (!element) return null;
    const value = evalStaticNumber(element, constants);
    if (!Number.isFinite(value)) return null;
    values.push(value);
  }
  return values;
}

function staticArrayLength(node) {
  return node?.type === "ArrayExpression" ? node.elements.length : null;
}

function formatRange(values) {
  return `[${values.map((value) => Number.isInteger(value) ? String(value) : value.toFixed(3)).join(", ")}]`;
}

export function validateComponent(rawSource) {
  let code = stripFences(rawSource);
  if (!code) {
    return { ok: false, error: "Empty source." };
  }
  // LLMs frequently omit the trailing `export default UserComposition;` even
  // though they define `export const UserComposition`. Auto-append it instead
  // of failing — Root.jsx imports the default.
  if (!code.includes("export default")) {
    if (/export\s+(const|function)\s+UserComposition\b/.test(code)) {
      code = `${code.trimEnd()}\n\nexport default UserComposition;\n`;
    } else {
      return { ok: false, error: "Source has no `export default` and no exported `UserComposition` component." };
    }
  }

  let ast;
  try {
    ast = parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });
  } catch (e) {
    return { ok: false, error: `Parse error: ${e.message}` };
  }

  const violations = [];
  const numericConstants = collectNumericConstants(ast);

  traverse(ast, {
    StringLiteral(p) {
      if (/^https?:\/\//i.test(p.node.value)) {
        violations.push("External URLs are not allowed. Use inline graphics or staticFile() assets.");
      }
    },
    ImportDeclaration(p) {
      const src = p.node.source.value;
      const isLibrary = COMPONENT_LIBRARY_SOURCES.has(src);
      if (!ALLOWED_IMPORTS.has(src) && !isLibrary) {
        violations.push(`Illegal import from "${src}" (only "react", "remotion", and "../components" allowed).`);
      }
      if (BANNED_NODE_MODULES.has(src)) {
        violations.push(`Banned node module import: "${src}".`);
      }
      if (isLibrary) {
        for (const specifier of p.node.specifiers) {
          if (
            specifier.type === "ImportDefaultSpecifier" ||
            specifier.type === "ImportNamespaceSpecifier"
          ) {
            violations.push(`Imports from "${src}" must be named (e.g. { BarChart }).`);
            continue;
          }
          const imported = specifier.imported?.name;
          if (!imported || !ALLOWED_LIBRARY_IMPORTS.has(imported)) {
            violations.push(`Unknown component import from "${src}": ${imported || specifier.type}.`);
          }
        }
      }
      if (src === "react") {
        for (const specifier of p.node.specifiers) {
          if (specifier.type !== "ImportDefaultSpecifier") {
            violations.push("React imports must use only the default import.");
          }
        }
      }
      if (src === "remotion") {
        for (const specifier of p.node.specifiers) {
          const imported = specifier.imported?.name;
          if (!imported || !ALLOWED_REMOTION_IMPORTS.has(imported)) {
            violations.push(`Unsupported Remotion import: ${imported || specifier.type}.`);
          }
        }
      }
    },
    Import(p) {
      // dynamic import()
      violations.push("Dynamic import() is not allowed.");
      void p;
    },
    CallExpression(p) {
      const callee = p.node.callee;
      if (callee.type === "Identifier" && BANNED_IDENTIFIERS.has(callee.name)) {
        violations.push(`Banned call: ${callee.name}().`);
      }
      if (
        callee.type === "Identifier" &&
        (callee.name === "interpolate" || callee.name === "interpolateColors")
      ) {
        const inputRange = evalStaticNumberArray(p.node.arguments[1], numericConstants);
        if (inputRange) {
          for (let i = 1; i < inputRange.length; i++) {
            if (inputRange[i] <= inputRange[i - 1]) {
              violations.push(
                `${callee.name}() inputRange must be strictly increasing; got ${formatRange(inputRange)}.`
              );
              break;
            }
          }
        }
        const inputLength = staticArrayLength(p.node.arguments[1]);
        const outputLength = staticArrayLength(p.node.arguments[2]);
        if (inputLength != null && outputLength != null && inputLength !== outputLength) {
          violations.push(
            `${callee.name}() inputRange and outputRange must have equal length; got ${inputLength} and ${outputLength}.`
          );
        }
      }
    },
    NewExpression(p) {
      const callee = p.node.callee;
      if (callee.type === "Identifier" && BANNED_IDENTIFIERS.has(callee.name)) {
        violations.push(`Banned constructor: new ${callee.name}().`);
      }
    },
    Identifier(p) {
      // Flag bare references to dangerous globals (not as property keys).
      if (
        BANNED_IDENTIFIERS.has(p.node.name) &&
        p.parent.type !== "ImportSpecifier" &&
        p.parent.type !== "MemberExpression" &&
        !(p.parent.type === "ObjectProperty" && p.parent.key === p.node)
      ) {
        // Allow it only if it's a locally-declared binding (rare). Be strict.
        violations.push(`Reference to banned identifier: ${p.node.name}.`);
      }
    },
    MemberExpression(p) {
      const obj = p.node.object;
      if (obj.type === "Identifier" && BANNED_GLOBALS_AS_OBJECT.has(obj.name)) {
        violations.push(`Access to banned global: ${obj.name}.${p.node.property.name ?? "*"}.`);
      }
      if (obj.type === "Identifier" && obj.name === "Math" && p.node.property?.name === "random") {
        violations.push("Math.random() is not allowed. Use remotion random(\"seed\") instead.");
      }
    },
  });

  // De-dupe and cap the message length.
  const unique = [...new Set(violations)];
  if (unique.length) {
    return { ok: false, error: unique.slice(0, 8).join("\n") };
  }

  return { ok: true, code };
}
