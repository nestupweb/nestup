import { beforeEach, expect, test, vi } from "vitest";

const compressImage = vi.fn();
vi.mock("@/lib/image-client", () => ({ compressImage: (f: File) => compressImage(f) }));

import { isVideoPath, prepareChatMedia, MAX_CHAT_MEDIA_BYTES, CHAT_MEDIA_ACCEPT } from "@/lib/chat-media";

const CONV = "11111111-1111-4111-8111-111111111111";
const file = (name: string, type: string) => new File(["x"], name, { type });

beforeEach(() => {
  compressImage.mockReset();
  // The default: the re-encoder hands back a JPEG, as it does for a photo.
  compressImage.mockImplementation(async () => new Blob(["x"], { type: "image/jpeg" }));
});

test("the picker offers photos and videos, not one format", () => {
  expect(CHAT_MEDIA_ACCEPT).toBe("image/*,video/*");
});

test("a video keeps its own container and lands in the video folder", async () => {
  for (const [name, type] of [
    ["clip.mov", "video/quicktime"],
    ["clip.MP4", "video/mp4"],
    ["clip.webm", "video/webm"],
    ["clip.mkv", "video/x-matroska"],
    ["clip.3gp", "video/3gpp"],
  ] as const) {
    const media = await prepareChatMedia(file(name, type), CONV);
    expect(media.kind).toBe("video");
    expect(media.contentType).toBe(type);
    // Never re-encoded — the blob that goes up is the file that came in.
    expect(media.blob).toBeInstanceOf(File);
    expect(media.path).toMatch(
      new RegExp(`^${CONV}/video/[0-9a-f-]+\\.${name.split(".").pop()!.toLowerCase()}$`),
    );
    expect(isVideoPath(media.path)).toBe(true);
  }
  expect(compressImage).not.toHaveBeenCalled();
});

test("a photo is still re-encoded, and stays out of the video folder", async () => {
  const media = await prepareChatMedia(file("IMG_1.HEIC", "image/heic"), CONV);
  expect(compressImage).toHaveBeenCalledOnce();
  expect(media.kind).toBe("image");
  expect(media.contentType).toBe("image/jpeg");
  expect(media.path).toMatch(new RegExp(`^${CONV}/[0-9a-f-]+\\.jpg$`));
  expect(isVideoPath(media.path)).toBe(false);
});

test("an image the canvas cannot decode is sent as-is rather than dropped", async () => {
  compressImage.mockRejectedValue(new Error("This image format isn't supported"));
  const original = file("drawing.avif", "image/avif");

  const media = await prepareChatMedia(original, CONV);
  expect(media.blob).toBe(original); // the original, not a failure
  expect(media.contentType).toBe("image/avif");
  expect(media.path).toMatch(new RegExp(`^${CONV}/[0-9a-f-]+\\.avif$`));
});

test("the video folder is one level down, so storage RLS still sees the conversation", async () => {
  const media = await prepareChatMedia(file("a.mp4", "video/mp4"), CONV);
  // The two chat-images policies key off storage.foldername(name)[1].
  expect(media.path.split("/")[0]).toBe(CONV);
});

test("the size ceiling matches the bucket's 50 MB", () => {
  expect(MAX_CHAT_MEDIA_BYTES).toBe(52428800);
});
