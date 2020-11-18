const workerPromise = new Promise(async (resolve) => {
  const response = await fetch(chrome.runtime.getURL("worker.js"));
  const blob = await response.blob();

  const worker = new Worker(URL.createObjectURL(blob));
  listenOnWorker(worker);

  resolve(worker);
});

const imageMap = new Map();
const idMap = new Map();

if (
  document.readyState === "interactive" ||
  document.readyState === "complete"
) {
  update();
  pixelatedNewImages();
} else {
  document.addEventListener("DOMContentLoaded", update);
  window.addEventListener("load", update);

  document.addEventListener("DOMContentLoaded", pixelatedNewImages);
  window.addEventListener("load", pixelatedNewImages);
}

window.addEventListener("scroll", debounce(pixelatedNewImages, 1000), {
  passive: true,
});

function update() {
  updateFavicon();
  updateLogo();
  updateSprites();
  updateTab2233();
  updatePacman();
  updateHeaderBanner();
}

function updateFavicon() {
  const link =
    document.querySelector("link[rel*='icon']") ||
    document.createElement("link");
  link.type = "image/png";
  link.rel = "icon";
  link.href = chrome.runtime.getURL("images/pilipili.png");

  document.querySelector("head").appendChild(link);
}

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
function debounce(func, wait, immediate) {
  let timeout;
  return function () {
    const context = this,
      args = arguments;
    const later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

function updateHeaderBanner() {
  const banner = document.querySelector(".international-header .bili-banner");
  const bannerLink = document.querySelector(
    ".international-header .banner-link"
  );
  if (banner && bannerLink) {
    bannerLink.style.backgroundImage = banner.style.backgroundImage;
    banner.style.backgroundImage = "none";
  }
}

function updateLogo() {
  const logo = document.querySelector(
    ".bili-banner .b-logo .head-logo .logo-img"
  );

  if (logo) {
    logo.src = chrome.runtime.getURL("images/logo.svg");
  }
}

// Replace the SVG sprite
async function updateSprites() {
  const target = document.querySelector("body > svg:first-child");
  if (target) {
    const spritesUrl = chrome.runtime.getURL("images/sprite.symbol.svg");
    const response = await fetch(spritesUrl);
    const svgText = await response.text();

    const svgElement = new DOMParser().parseFromString(svgText, "image/svg+xml")
      .documentElement;
    svgElement.setAttribute("aria-hidden", "true");
    svgElement.style.cssText =
      "position: absolute; width: 0px; height: 0px; overflow: hidden;";

    target.parentElement.replaceChild(svgElement, target);
  }
}

function updateTab2233() {
  const target = document.querySelector(".elevator .bg23");
  if (target) {
    target.style.backgroundImage = `url(${chrome.runtime.getURL(
      "images/tab2233.png"
    )})`;
  }
}

function updatePacman() {
  const targets = document.querySelector(".home-slide .trigger");
  if (targets) {
    targets.style = `--pacman: url("${chrome.runtime.getURL(
      "images/pacman.png"
    )}")`;
  }
}

////////////////////////////////////////////////////////////////////////////////
// import "regenerator-runtime/runtime";

function pixelatedNewImages() {
  document
    // Exclude the site logo
    .querySelectorAll(
      ".international-home .first-screen img:not([data-pixelated]), .international-home .storey-box img:not([data-pixelated])"
    )
    .forEach((image) => {
      image.crossOrigin = "anonymous";
      image.dataset.pixelated = "ongoing";

      if (image.complete && image.naturalWidth) {
        pixelateImage(image);
      } else {
        image.addEventListener("load", (e) => {
          pixelateImage(e.target);
        });
      }
    });
}

function pixelateImage(image) {
  // If you just want to pixelate human bodies in the image,
  // use pixelateBodiesInImages(image) instead of pixelateTheWholeImage(image)
  pixelateTheWholeImage(image);
}

// Send to work for masking
async function pixelateBodiesInImages(image) {
  const id = generateId();

  if (idMap.has(image)) {
    return;
  } else {
    imageMap.set(id, image);
    idMap.set(image, id);
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);

  const imageData = await ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data.buffer;

  const worker = await workerPromise;
  worker.postMessage(
    {
      id,
      pixels,
      width: imageData.width,
      height: imageData.height,
    },
    [imageData.data.buffer]
  );
}

function listenOnWorker(worker) {
  // Get the mask from worker and draw it
  worker.addEventListener("message", async ({ data }) => {
    const { id, maskBitmap } = data;
    const image = imageMap.get(id);

    const blob = await pixelateByMask(image, maskBitmap);
    console.log("done:", image);
    const blobUrl = URL.createObjectURL(blob);
    image.src = blobUrl;
    image.addEventListener("load", (e) => {
      e.target.dataset.pixelated = "done";
      URL.revokeObjectURL(blobUrl);
    });
  });
}

async function pixelateByMask(image, maskBitmap, factor = 60) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
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

async function pixelateTheWholeImage(image, factor = 60) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");

  // draw the original image first
  ctx.drawImage(image, 0, 0);

  /// calculate the factor
  const fw = Math.round((canvas.width * factor) / 1000);
  const fh = Math.round((canvas.height * factor) / 1000);

  /// draw mini-version of image
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, fw, fh);

  /// draw the mini-version back up, voila, pixelated
  ctx.drawImage(canvas, 0, 0, fw, fh, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob))
  );
  image.src = URL.createObjectURL(blob);
  image.addEventListener("load", (e) => {
    e.target.dataset.pixelated = "done";
    URL.revokeObjectURL(URL.createObjectURL(blob));
  });
}
