const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const from = path.join(root, "node_modules", "@vladmandic", "face-api", "model");
const to = path.join(root, "frontend", "public", "models");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn("Face model fayllari topilmadi. npm install tugagach npm run prepare:models ishlating.");
    return;
  }

  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const source = path.join(src, entry.name);
    const target = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(source, target);
    } else {
      fs.copyFileSync(source, target);
    }
  }
}

copyDir(from, to);
console.log("Face ID model fayllari frontend/public/models papkasiga tayyorlandi.");
