import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-wasm";
import "@tensorflow/tfjs-backend-cpu";
import { load, toMask } from "@tensorflow-models/body-pix";

async function loadAndPredict(image) {
  const net = await load();

  return net.segmentPersonParts(image, {
    flipHorizontal: false,
    internalResolution: image.width >= 224 ? "medium" : "full",
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

export async function getBodyMask(originalImage) {
  if (!cache.has(originalImage)) {
    const partSegmentation = await loadAndPredict(originalImage);
    const torsoMask = getTorsoMask(partSegmentation);

    cache.set(originalImage, torsoMask);
  }

  return cache.get(originalImage);
}
