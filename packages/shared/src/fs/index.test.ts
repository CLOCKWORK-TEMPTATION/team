import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readTextFile, writeTextFile, fileExists, findFiles } from "./index.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("fs utilities", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fs-utils-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("writeTextFile and readTextFile", () => {
    it("should write and read file content correctly", async () => {
      const filePath = path.join(tempDir, "test.txt");
      const content = "hello world";
      
      await writeTextFile(filePath, content);
      const readContent = await readTextFile(filePath);
      
      expect(readContent).toBe(content);
    });

    it("should create intermediate directories when writing", async () => {
      const filePath = path.join(tempDir, "deep", "dir", "test.txt");
      await writeTextFile(filePath, "content");
      
      const exists = await fileExists(filePath);
      expect(exists).toBe(true);
    });
  });

  describe("fileExists", () => {
    it("should return true if file exists", async () => {
      const filePath = path.join(tempDir, "exists.txt");
      await writeTextFile(filePath, "");
      expect(await fileExists(filePath)).toBe(true);
    });

    it("should return false if file does not exist", async () => {
      const filePath = path.join(tempDir, "not-exists.txt");
      expect(await fileExists(filePath)).toBe(false);
    });
  });

  describe("findFiles", () => {
    it("should find files matching patterns and respect ignore rules", async () => {
      await writeTextFile(path.join(tempDir, "src", "index.ts"), "");
      await writeTextFile(path.join(tempDir, "src", "utils.ts"), "");
      await writeTextFile(path.join(tempDir, "dist", "index.js"), "");
      await writeTextFile(path.join(tempDir, "node_modules", "package", "index.ts"), "");

      const files = await findFiles(tempDir, ["**/*.ts", "**/*.js"], ["node_modules", "dist"]);
      
      expect(files).toHaveLength(2);
      expect(files.sort()).toEqual(["src/index.ts", "src/utils.ts"].sort());
    });
  });
});
