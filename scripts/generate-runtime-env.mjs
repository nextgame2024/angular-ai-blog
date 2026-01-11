import fs from "fs";
import path from "path";

const templatePath = path.resolve("src/assets/runtime-config.template.json");
const outputPath = path.resolve("src/assets/runtime-config.json");

if (!fs.existsSync(templatePath)) {
  console.error(`Missing template: ${templatePath}`);
  process.exit(1);
}

const apiKey = (process.env.GOOGLE_MAPS_API_KEY || "").trim();
if (!apiKey) {
  console.error(
    "Missing GOOGLE_MAPS_API_KEY (set it in your shell for local dev)."
  );
  process.exit(1);
}

const raw = fs.readFileSync(templatePath, "utf8");
const out = raw.replace(/__GOOGLE_MAPS_API_KEY__/g, apiKey);

fs.writeFileSync(outputPath, out, "utf8");
console.log(`Generated ${outputPath}`);
