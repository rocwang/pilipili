import "regenerator-runtime/runtime";

// creat worker thread
const worker = new Worker("worker.js");
const imageMap = new Map();

// Send to work for masking
document.getElementById("pixelate").addEventListener("click", () => {
  document.querySelectorAll("img.original").forEach(async (image) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);

    const id = generateId();
    const imageData = await ctx.getImageData(0, 0, image.width, image.height);
    const pixels = imageData.data.buffer;
    imageMap.set(id, image);

    worker.postMessage(
      {
        id,
        pixels,
        width: imageData.width,
        height: imageData.height,
      },
      [imageData.data.buffer]
    );
  });
});

// Get the mask from worker and draw it
worker.addEventListener("message", async ({ data }) => {
  const { id, maskBitmap } = data;
  console.log(id, maskBitmap);

  const image = imageMap.get(id);

  const blob = await pixelateByMask(image, maskBitmap, 100);
  const blobUrl = URL.createObjectURL(blob);
  image.nextElementSibling.src = blobUrl;
  image.nextElementSibling.addEventListener("load", () =>
    URL.revokeObjectURL(blobUrl)
  );
});

async function pixelateByMask(image, maskBitmap, factor) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");

  ctx.globalCompositeOperation = "copy";
  ctx.drawImage(maskBitmap, 0, 0);

  // draw the original image first
  ctx.globalCompositeOperation = "source-in";
  ctx.drawImage(image, 0, 0);

  /// calculate the factor
  const fw = Math.round((canvas.width * factor) / 1000);
  const fh = Math.round((canvas.height * factor) / 1000);

  /// draw mini-version of image
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = "copy";
  ctx.drawImage(canvas, 0, 0, fw, fh);

  /// draw the mini-version back up, voila, pixelated
  ctx.drawImage(canvas, 0, 0, fw, fh, 0, 0, canvas.width, canvas.height);

  // overlay the mosaic area over the original image
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = "destination-over";
  ctx.drawImage(image, 0, 0);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob)));
}

function generateId() {
  return "_" + Math.random().toString(36).substr(2, 9);
}
