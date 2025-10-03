import { glob } from "glob";
import path from "path";

type HookModule = {
  userSubmitPrompt: (prompt: string) => string;
};

export const loadHooks = async () => {
  const hooks: ((prompt: string) => string)[] = [];
  const hookFiles = await glob(
    path.join(
      process.cwd(),
      "agents",
      "*.UserSubmitPrompt.ts"
    )
  );

  for (const file of hookFiles) {
    const module: HookModule = await import(file);
    if (module.userSubmitPrompt) {
      hooks.push(module.userSubmitPrompt);
    }
  }

  return hooks;
};

export const runUserSubmitHooks = async (prompt: string) => {
  const hooks = await loadHooks();
  let modifiedPrompt = prompt;
  for (const hook of hooks) {
    modifiedPrompt = hook(modifiedPrompt);
  }
  return modifiedPrompt;
};
