import { afterEach, beforeEach, expect, test, vi } from "vitest";

// The decoder is a dynamic import inside compressImage; stub the module so the
// tests can tell whether it was reached without pulling 1.3 MB of wasm.
const heic2any = vi.fn();
vi.mock("heic2any", () => ({ default: (opts: unknown) => heic2any(opts) }));

import { compressImage, isHeic } from "@/lib/image-client";

const bigJpeg = () => new File([new Uint8Array(500 * 1024)], "photo.jpg", { type: "image/jpeg" });
const heicFile = () => new File([new Uint8Array(1024)], "IMG_4821.HEIC", { type: "image/heic" });

beforeEach(() => {
  heic2any.mockReset();
  heic2any.mockResolvedValue(new Blob([new Uint8Array(64)], { type: "image/jpeg" }));

  // Only a JPEG decodes natively here — exactly the desktop browser's position
  // on a HEIC, which is what sends this down the fallback path.
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async (blob: Blob) => {
      if (blob.type === "image/jpeg") return { width: 3000, height: 2000, close: () => {} };
      throw new Error("cannot decode");
    })
  );
  // The <img> fallback inside decodeNative: fail it immediately rather than
  // waiting on jsdom, which never loads a blob: URL.
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
  );
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:test", configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb: BlobCallback) {
    cb(new Blob([new Uint8Array(32)], { type: "image/jpeg" }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("isHeic spots Apple's format by type or by file name", () => {
  expect(isHeic(heicFile())).toBe(true);
  expect(isHeic(new File([], "x.heif", { type: "" }))).toBe(true);
  expect(isHeic(new File([], "x.jpg", { type: "image/heic" }))).toBe(true); // type wins
  expect(isHeic(bigJpeg())).toBe(false);
  expect(isHeic(new File([], "holiday.heicopter.png", { type: "image/png" }))).toBe(false);
});

test("a HEIC the browser cannot read is decoded and comes back as a JPEG", async () => {
  const out = await compressImage(heicFile());
  expect(heic2any).toHaveBeenCalledOnce();
  expect(heic2any.mock.calls[0][0]).toMatchObject({ toType: "image/jpeg" });
  expect(out.type).toBe("image/jpeg");
});

test("a HEIC that decodes to several frames uses the first", async () => {
  heic2any.mockResolvedValue([
    new Blob([new Uint8Array(8)], { type: "image/jpeg" }),
    new Blob([new Uint8Array(8)], { type: "image/jpeg" }),
  ]);
  await expect(compressImage(heicFile())).resolves.toBeInstanceOf(Blob);
});

test("an ordinary photo never loads the decoder", async () => {
  const out = await compressImage(bigJpeg());
  expect(out.type).toBe("image/jpeg");
  expect(heic2any).not.toHaveBeenCalled();
});

test("a small web-friendly photo is passed straight through, untouched", async () => {
  const small = new File([new Uint8Array(1024)], "tiny.png", { type: "image/png" });
  expect(await compressImage(small)).toBe(small);
  expect(heic2any).not.toHaveBeenCalled();
});

test("an undecodable file that isn't HEIC still fails, without reaching the decoder", async () => {
  await expect(compressImage(new File([new Uint8Array(64)], "art.avif", { type: "image/avif" }))).rejects.toThrow();
  expect(heic2any).not.toHaveBeenCalled();
});
