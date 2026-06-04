import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const SRC = "/Users/jewelessien/Projects/bladeV1/pic and images";
const OUT = "/Users/jewelessien/Projects/bladeV1/public/images";
mkdirSync(OUT, { recursive: true });

// Convert a HEIC to a temp JPEG via macOS sips (sharp can't read HEIC).
function heicToJpeg(name) {
  const tmp = path.join(os.tmpdir(), `${name}.jpg`);
  execFileSync("sips", ["-s", "format", "jpeg", path.join(SRC, `${name}.HEIC`), "--out", tmp]);
  return tmp;
}

async function emit(input, outName, { width = 1600, crop } = {}) {
  let img = sharp(input).rotate();
  if (crop) img = img.extract(crop);
  await img
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(OUT, `${outName}.webp`));
  console.log("wrote", `${outName}.webp`);
}

async function main() {
  // Brand / hero
  await emit(path.join(SRC, "03_neon_sign_a_web.jpg"), "neon-sign", { width: 1600 });
  // Vibe / gallery
  await emit(path.join(SRC, "01_interior_wide_web.jpg"), "interior-wide", { width: 1600 });
  await emit(path.join(SRC, "02_interior_chairs_web.jpg"), "interior-chairs", { width: 1200 });
  await emit(path.join(SRC, "05_entrance_web.jpg"), "entrance", { width: 1200 });

  // Finished-cut screenshots — crop out phone/IG chrome.
  // Source is 1206x2622. Drop the top status/nav bar, the right-edge IG action
  // icons (heart/comment/share), and the bottom handle/comment band.
  const cropCut = { left: 40, top: 300, width: 1020, height: 1620 };
  await emit(heicToJpeg("IMG_3126"), "cut-1", { width: 1000, crop: cropCut });
  await emit(heicToJpeg("IMG_3127"), "cut-2", { width: 1000, crop: cropCut });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
