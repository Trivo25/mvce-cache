import { ShaGadgetIssue } from "./program.js";
import { Cache, Field, ZkProgram } from "o1js";
import path from "path";
import fs from "fs";

async function main() {
  const cacheDir = path.resolve("./cache");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // Compile the program (generates verification keys, circuits, etc.)
  console.log("Compiling ZkProgram...");
  await ShaGadgetIssue.compile({ cache: Cache.FileSystem(cacheDir) }); // Make sure this outputs build artifacts

  console.log("Running compute method...");
  const proof = await ShaGadgetIssue.compute(new Field(0));

  console.log("Proof generated:", proof);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
