import { config } from "dotenv";
import path from "node:path";
config({ path: path.join(__dirname, "..", ".env.local") });

async function main() {
  const { generateImage } = await import("../src/lib/gemini");
  const started = Date.now();
  const img = await generateImage({
    prompt:
      'Editorial food photography: a torched miso caramel pavlova on a ceramic plate, warm golden-hour window light, 45-degree angle, shallow depth of field, deep eucalyptus green linen backdrop, terracotta accents, steam rising, "no text"',
    aspectRatio: "4:5",
    imageSize: "1K",
  });
  console.log("image ok:", img.mimeType, `${Math.round(img.base64.length * 0.75 / 1024)}KB`, `${Date.now() - started}ms`, "model:", img.model);

  const { uploadAsset } = await import("../src/lib/storage");
  const up = await uploadAsset(`smoke/pavlova-${Date.now()}.png`, Buffer.from(img.base64, "base64"), img.mimeType);
  console.log("storage ok:", up.publicUrl);
}

main().catch((e) => { console.error("SMOKE FAILED:", e); process.exit(1); });
