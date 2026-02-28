import { Command } from "commander";
import { scanCommand } from "./scan.js";
import { planCommand } from "./plan.js";
import { applyCommand } from "./apply.js";
import { verifyCommand } from "./verify.js";

const program = new Command();

program
  .name("repo-refactor")
  .description("Repo Refactor AI CLI")
  .version("0.1.0");

program.addCommand(scanCommand);
program.addCommand(planCommand);
program.addCommand(applyCommand);
program.addCommand(verifyCommand);

program.parse(process.argv);