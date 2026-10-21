// graphify OpenCode plugin (OpenCode v2 API)
// Reminds the agent to query the local knowledge graph before grepping raw files.
//
// v2 notes:
//  - Plugins must default-export a definition with an `id` and a `setup(ctx)` function.
//  - Hooks are registered on the domain that owns them: ctx.tool.hook("execute.before", ...).
//  - The shell tool is named "shell" (not "bash") in v2.
//  - The event carries a single mutable `input` object instead of (input, output) pairs.
import { existsSync } from "node:fs";
import { join } from "node:path";

const REMINDER =
  "[graphify] knowledge graph at graphify-out/. For focused questions run " +
  '`graphify query "<question>"` (scoped subgraph, usually much smaller than GRAPH_REPORT.md) ' +
  "instead of grepping raw files. Read GRAPH_REPORT.md only for broad architecture context.";

const WINDOWS = process.platform === "win32";

/** Quote a string for the host shell and pick a separator it actually supports. */
function preface(text, command) {
  if (WINDOWS) {
    // PowerShell 5.1 has no `&&` operator - `;` is the portable statement separator.
    const quoted = "'" + text.replace(/'/g, "''") + "'";
    return `Write-Output ${quoted}; ${command}`;
  }
  return `echo '${text.replace(/'/g, "'\\''")}' && ${command}`;
}

export default {
  id: "graphify",
  async setup(ctx) {
    let reminded = false;
    const directory = ctx.location.directory;

    await ctx.tool.hook("execute.before", (event) => {
      if (reminded) return;
      if (event.tool !== "shell") return;
      if (!existsSync(join(directory, "graphify-out", "graph.json"))) return;

      const input = event.input;
      if (!input || typeof input.command !== "string") return;

      input.command = preface(REMINDER, input.command);
      reminded = true;
    });
  },
};
