import { compressImage } from "@/lib/image-client";

/** Anything a camera roll can hand over — the browser's own picker filters it. */
export const CHAT_MEDIA_ACCEPT = "image/*,video/*";

/**
 * 50 MB. Photos leave the device re-encoded to a few hundred KB, so this is
 * really the video ceiling: roughly a minute of 1080p from a phone. The bucket
 * enforces the same number, so a file that slips past the check here is still
 * refused by storage rather than half-uploaded.
 */
export const MAX_CHAT_MEDIA_BYTES = 50 * 1024 * 1024;

/**
 * Videos are stored one folder deeper — `<conversation>/video/<uuid>.<ext>` —
 * so a stored path says what it holds on its own. The alternative, sniffing the
 * extension, needs an allow-list that has to keep up with whatever container a
 * phone decides to write next (.mov, .m4v, .3gp, .mkv…); a file whose extension
 * we hadn't listed would render as a broken <img>.
 *
 * Storage RLS is unaffected: both chat-images policies key off
 * `storage.foldername(name)[1]`, which is still the conversation id.
 */
export const isVideoPath = (path: string) => path.includes("/video/");

/** `IMG_0421.HEIC` → `heic`, falling back to the MIME subtype then `fallback`. */
function extensionOf(file: File, fallback: string): string {
  const clean = (s: string) => (/^[a-z0-9]{1,5}$/i.test(s) ? s.toLowerCase() : "");
  return clean(file.name.split(".").pop() ?? "") || clean(file.type.split("/")[1] ?? "") || fallback;
}

export type PreparedMedia = {
  blob: Blob;
  /** Object key inside the `chat-images` bucket. */
  path: string;
  contentType: string;
  kind: "image" | "video";
};

/**
 * Turns a picked file into something uploadable.
 *
 * Photos still go through the canvas re-encoder (≤1600px JPEG), which is what
 * turns an iPhone HEIC into something every browser can show — including on a
 * desktop browser that cannot decode HEIC itself, which is where a photo used to
 * upload as a raw .heic and arrive in the thread as a download link. When even
 * that fails we upload the original instead of refusing it: an exotic format
 * that only some browsers render still beats losing the message. Videos are
 * never re-encoded: the browser has no cheap way to do it, and a phone clip is
 * already H.264.
 */
export async function prepareChatMedia(file: File, conversationId: string): Promise<PreparedMedia> {
  const id = crypto.randomUUID();

  if (file.type.startsWith("video/")) {
    return {
      blob: file,
      path: `${conversationId}/video/${id}.${extensionOf(file, "mp4")}`,
      contentType: file.type || "video/mp4",
      kind: "video",
    };
  }

  let blob: Blob = file;
  try {
    blob = await compressImage(file);
  } catch {
    /* undecodable here — send it as it came rather than dropping the message */
  }
  const ext =
    blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : blob === file ? extensionOf(file, "jpg") : "jpg";
  return {
    blob,
    path: `${conversationId}/${id}.${ext}`,
    contentType: blob.type || file.type || "image/jpeg",
    kind: "image",
  };
}
