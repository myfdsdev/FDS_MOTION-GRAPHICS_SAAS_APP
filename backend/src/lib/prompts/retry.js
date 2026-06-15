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
- Return exactly ONE file/module. Do not paste the old broken file below the
  fixed file. Do not include explanations before or after the code.
- Put all import statements at the very top. Never place import/export
  statements inside a component, helper function, loop, condition, or JSX.
- Do not use named exports for helpers. Helpers must be plain const/function
  declarations. The only export at the end should be:
  export default UserComposition;
- For every interpolate()/interpolateColors() call, inputRange must be strictly
  increasing after constants are evaluated, and outputRange must be the same
  length. If the error mentions a range like [555,585,570,590], reorder or
  rewrite that range so it only increases.
Keep everything that worked; change only what's needed to fix the error.
`.trim();
