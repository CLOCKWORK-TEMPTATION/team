import { Command } from "commander";

export const verifyCommand = new Command("verify")
  .description("Verify applied refactor changes")
  .action(() => {
    console.log("Verifying changes...");
    // TODO: implement verify logic
  });