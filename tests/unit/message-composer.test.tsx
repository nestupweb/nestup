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
