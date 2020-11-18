import { ready } from "@tensorflow/tfjs-core";
import "regenerator-runtime/runtime";
import "@tensorflow/tfjs-backend-webgl";
// import "@tensorflow/tfjs-backend-wasm";
import "@tensorflow/tfjs-backend-cpu";
import { load, toMask } from "@tensorflow-models/body-pix";

async function loadAndPredict(imageData) {
  const net = await load();

  return net.segmentPersonParts(imageData, {
    flipHorizontal: false,
    internalResolution: imageData.width >= 224 ? "medium" : "full",
    segmentationThreshold: 0.7,
  });
}

function getTorsoMask(partSegmentation) {
  const foregroundColor = { r: 0, g: 0, b: 0, a: 255 };
  const backgroundColor = { r: 0, g: 0, b: 0, a: 0 };

  return toMask(partSegmentation, foregroundColor, backgroundColor, false, [
    2,
    3,
    4,
    5,
    12,
    13,
    14,
    15,
    16,
    17,
  ]);
}

let cache = new Map();

export async function getBodyMask(imageBimap) {
  if (!cache.has(imageBimap)) {
    const partSegmentation = await loadAndPredict(imageBimap);
    const torsoMask = getTorsoMask(partSegmentation);

    cache.set(imageBimap, torsoMask);
  }

  return cache.get(imageBimap);
}

// listen to worker if any message is there
self.addEventListener("message", async ({ data }) => {
  const { id, pixels, width, height } = data;
  console.log("worker:", id, width, height);

  const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);
  await ready();
  const mask = await getBodyMask(imageData);
  const maskBitmap = await createImageBitmap(mask);

  self.postMessage({ id, maskBitmap }, [maskBitmap]);
});
