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
  // Strip a leading ```lang and trailing ``` if present.
  s = s.replace(/^```[a-zA-Z]*\s*\n?/, "").replace(/\n?```\s*$/, "");
  // If the model added prose before the code, cut to the first import/`export`.
  const firstImport = s.indexOf("import ");
  if (firstImport > 0 && firstImport < 400) s = s.slice(firstImport);
  return s.trim();
}

export function validateComponent(rawSource) {
  const code = stripFences(rawSource);
  if (!code || !code.includes("export default")) {
    return { ok: false, error: "Source has no `export default` component." };
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

  traverse(ast, {
    ImportDeclaration(p) {
      const src = p.node.source.value;
      if (!ALLOWED_IMPORTS.has(src)) {
        violations.push(`Illegal import from "${src}" (only "react" and "remotion" allowed).`);
      }
      if (BANNED_NODE_MODULES.has(src)) {
        violations.push(`Banned node module import: "${src}".`);
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
    },
  });

  // De-dupe and cap the message length.
  const unique = [...new Set(violations)];
  if (unique.length) {
    return { ok: false, error: unique.slice(0, 8).join("\n") };
  }

  return { ok: true, code };
}
