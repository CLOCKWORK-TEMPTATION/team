import { promptOpenAI } from "./providers/openai.js";
import { generatePlannerPrompt } from "./prompts/planner-prompt.js";

export async function askPlanner(findingsSummary: string): Promise<string> {
  const prompt = generatePlannerPrompt(findingsSummary);
  // For now, defaulting to OpenAI, but this router should choose based on config
  return await promptOpenAI(prompt, "gpt-4o");
}

export async function askPatchAuthor(task: string): Promise<string> {
  const prompt = `You are a patch author. Write code for this task:\n\n${task}`;
  return await promptOpenAI(prompt, "gpt-4o");
}
