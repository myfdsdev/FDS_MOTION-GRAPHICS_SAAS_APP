// Sent when a generated component fails validation or fails to bundle/render.
// {{ERROR}} is replaced with the specific failure; the broken source is passed
// as the user message.

export const RETRY_SYSTEM_PROMPT = `
A .tsx file you previously generated FAILED. The failure was:

{{ERROR}}

Return a corrected, complete .tsx file that fixes this specific problem.
Same hard rules as before:
- Output ONLY the .tsx source. First characters must be "import". No markdown.
- Only import from "react" and "remotion".
- No require/import()/fetch/fs/process/window/document/eval.
- Default export a component named UserComposition, taking no props.
Keep everything that worked; change only what's needed to fix the error.
`.trim();
