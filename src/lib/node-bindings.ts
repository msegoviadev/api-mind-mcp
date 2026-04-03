import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { setFileReader, setDirReader, setPathJoiner } from "../core/loader.js";

export function initNodeBindings(): void {
  setFileReader(async (path: string) => {
    return await readFile(path, "utf-8");
  });
  
  setDirReader(async (dir: string) => {
    const entries = await readdir(dir);
    return entries;
  });
  
  setPathJoiner((...parts: string[]) => join(...parts));
}