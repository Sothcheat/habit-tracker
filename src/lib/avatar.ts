/**
 * Turning whatever the user picked into the one image we store.
 *
 * The bucket accepts 2 MiB, but nothing here gets close: an avatar is shown at
 * 32px in the header and 48px in the popover, so a 512px square is already
 * three times what the densest screen can use. Everything below exists to get
 * there from a 12 MP phone photo without the result looking soft or sideways.
 *
 * Why WebP rather than JPEG: same encoder call, roughly 25-30% smaller at a
 * matched quality, and it keeps transparency, which a cropped PNG logo may
 * rely on. JPEG is the fallback for browsers that cannot encode WebP — and
 * that fallback is not optional, because `toBlob` does not fail on a format it
 * does not support. It quietly hands back PNG instead, which at 512px can run
 * to several hundred KB of losslessly-encoded photograph.
 */

/** The stored square. Three times the largest size the UI renders. */
const SIZE = 512;

/**
 * The largest file a user may choose, checked before anything is decoded —
 * decoding runs on the main thread, and a 100 MP image can hang the tab.
 *
 * It caps the file *chosen*, not the file uploaded: everything here is
 * re-encoded to a 512px square first, so what reaches the bucket is well under
 * 100 KB regardless. The cap is therefore not about storage at all — it is
 * about what the browser is asked to decode, and about refusing junk early.
 *
 * Which is why it is 15 MB rather than something that sounds stricter. A
 * modern phone photo is 3-8 MB, and a limit that refuses one is a limit that
 * refuses the most common legitimate case — for no benefit, since the file is
 * about to be re-encoded to a fraction of its size anyway. The storage limit
 * that actually protects the bucket is the bucket's own 2 MiB, server-side,
 * where a hostile client cannot reach it.
 */
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

const QUALITY = { webp: 0.92, jpeg: 0.9 } as const;

/** What the picker offers and what the bucket accepts, kept in one place. */
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type PreparedAvatar = { blob: Blob; extension: "webp" | "jpg" };

/**
 * The one guard on what a user may choose, run the moment they choose it so
 * the answer is immediate and nothing is uploaded to find out.
 *
 * Returns the reason to show them, or null if the file is fine. It is not the
 * only check: the bucket enforces its own size and MIME limits server-side,
 * because a client-side guard is a courtesy to honest users and nothing at all
 * to a hostile one. This exists so the honest majority get a sentence instead
 * of a failed request.
 *
 * `file.type` is the browser's sniff of the file, not a claim by the server,
 * but it is still only a guess from the extension and magic bytes — a renamed
 * .exe can present as image/png. Decoding is what actually proves it is an
 * image, and that happens next in prepareAvatar.
 */
export function validateAvatarFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "That file isn't an image. Choose a JPEG, PNG or WebP.";
  }
  if (file.size > MAX_INPUT_BYTES) {
    return `That image is ${formatSize(file.size)}. Choose one under ${formatSize(MAX_INPUT_BYTES)}.`;
  }
  return null;
}

function formatSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  // Whole numbers for the limit itself, one decimal for a real file's size.
  return `${mb >= 10 || Number.isInteger(mb) ? Math.round(mb) : mb.toFixed(1)} MB`;
}

/** Cached: it builds a canvas, and the answer cannot change mid-session. */
let webpEncodable: boolean | undefined;

function canEncodeWebp(): boolean {
  if (webpEncodable === undefined) {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    webpEncodable = probe.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpEncodable;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("That image couldn't be processed.")),
      type,
      quality,
    );
  });
}

/**
 * Decodes, centre-crops to a square, scales to at most 512px and re-encodes.
 *
 * Throws with a message meant for the user — the caller shows it as-is.
 */
export async function prepareAvatar(file: File): Promise<PreparedAvatar> {
  const rejection = validateAvatarFile(file);
  if (rejection) throw new Error(rejection);

  // `imageOrientation` is the reason for createImageBitmap over an <img>: a
  // photo taken in portrait carries its rotation in EXIF, and without this it
  // decodes on its side.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That image couldn't be read. Try a JPEG or PNG.");
  }

  try {
    // Crop the largest centred square, then scale it down — never up. An
    // avatar smaller than 512px is stored at its own size; stretching it would
    // add bytes and blur without adding detail.
    const side = Math.min(bitmap.width, bitmap.height);
    const target = Math.min(side, SIZE);

    const canvas = document.createElement("canvas");
    canvas.width = target;
    canvas.height = target;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("That image couldn't be processed.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      target,
      target,
    );

    return canEncodeWebp()
      ? {
          blob: await toBlob(canvas, "image/webp", QUALITY.webp),
          extension: "webp",
        }
      : {
          blob: await toBlob(canvas, "image/jpeg", QUALITY.jpeg),
          extension: "jpg",
        };
  } finally {
    // The decoded bitmap holds width x height x 4 bytes until it is closed,
    // which for a 12 MP photo is ~48 MB.
    bitmap.close();
  }
}
