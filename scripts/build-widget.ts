import * as esbuild from "esbuild";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(__dirname, "../src/widget/index.ts")],
  bundle: true,
  minify: process.env.NODE_ENV !== "development",
  outfile: path.join(__dirname, "../public/widget.js"),
  format: "iife",
  target: ["es2017", "chrome80", "firefox78", "safari13"],
  platform: "browser",
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production"),
  },
});

console.log("✅ Widget built → public/widget.js");
