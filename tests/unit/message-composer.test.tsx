import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload: vi.fn() }) } }) }));
vi.mock("@/lib/image-client", () => ({ compressImage: vi.fn() }));

import { MessageComposer } from "@/components/chat/MessageComposer";

afterEach(cleanup);

const CONVERSATION = "11111111-1111-4111-8111-111111111111";

function setup() {
  const onSend = vi.fn();
  render(<MessageComposer conversationId={CONVERSATION} onSend={onSend} />);
  const box = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;
  box.focus();
  return { onSend, box };
}

test("Enter sends the trimmed text, clears the field and keeps the cursor in it", () => {
  const { onSend, box } = setup();
  fireEvent.change(box, { target: { value: "  hello there  " } });
  fireEvent.keyDown(box, { key: "Enter" });
  expect(onSend).toHaveBeenCalledWith({ content: "hello there", imagePath: null, imagePreview: null });
  expect(box.value).toBe("");
  expect(document.activeElement).toBe(box);
});

test("Shift+Enter does not send (newline), and an empty field never sends", () => {
  const { onSend, box } = setup();
  fireEvent.change(box, { target: { value: "line one" } });
  fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
  expect(onSend).not.toHaveBeenCalled();
  expect(box.value).toBe("line one");

  fireEvent.change(box, { target: { value: "   " } });
  fireEvent.keyDown(box, { key: "Enter" });
  expect(onSend).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
});

test("the Send button submits too, and focus returns to the field afterwards", () => {
  const { onSend, box } = setup();
  fireEvent.change(box, { target: { value: "via button" } });
  const send = screen.getByRole("button", { name: "Send" });
  send.focus();
  fireEvent.click(send);
  expect(onSend).toHaveBeenCalledWith({ content: "via button", imagePath: null, imagePreview: null });
  expect(document.activeElement).toBe(box);
});

test("the schedule shortcut stays in the composer", () => {
  const onSchedule = vi.fn();
  render(<MessageComposer conversationId={CONVERSATION} onSend={vi.fn()} onSchedule={onSchedule} />);
  fireEvent.click(screen.getByRole("button", { name: "Schedule a viewing" }));
  expect(onSchedule).toHaveBeenCalled();
});

test("a HEIC preview is swapped for the re-encoded JPEG, so the thumbnail is never a broken image", async () => {
  const urls: Blob[] = [];
  const created: string[] = [];
  const revoked: string[] = [];
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (b: Blob) => {
      urls.push(b);
      const u = `blob:test/${urls.length}`;
      created.push(u);
      return u;
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: (u: string) => revoked.push(u) });

  // What prepareChatMedia does for a HEIC now: hands back a different blob.
  const jpeg = new Blob([new Uint8Array(8)], { type: "image/jpeg" });
  const media = await import("@/lib/chat-media");
  const spy = vi.spyOn(media, "prepareChatMedia").mockResolvedValue({
    blob: jpeg,
    path: `${CONVERSATION}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg`,
    contentType: "image/jpeg",
    kind: "image",
  });

  setup();
  const input = screen.getByLabelText("Attach a photo or video") as HTMLInputElement;
  const heic = new File([new Uint8Array(16)], "IMG_4821.HEIC", { type: "image/heic" });
  fireEvent.change(input, { target: { files: [heic] } });

  const shown = await screen.findByAltText("Photo to send");
  await vi.waitFor(() => expect(shown.getAttribute("src")).toBe(created[1]));
  // The second URL is the one made from the JPEG, not from the picked HEIC.
  expect(urls[0]).toBe(heic);
  expect(urls[1]).toBe(jpeg);

  // Dropping the attachment releases both, so the superseded one cannot leak.
  fireEvent.click(screen.getByRole("button", { name: /remove/i }));
  expect(revoked).toEqual(expect.arrayContaining([created[0], created[1]]));
  spy.mockRestore();
});
