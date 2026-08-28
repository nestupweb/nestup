import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { PhotoCheckResult } from "@/app/actions/photo-check";

const check = vi.fn<(body: FormData) => Promise<PhotoCheckResult>>();
const checkStored = vi.fn<(url: string, label: string) => Promise<PhotoCheckResult>>();

vi.mock("@/app/actions/photo-check", () => ({
  checkAndUploadPhotoAction: (body: FormData) => check(body),
  checkStoredPhotoAction: (url: string, label: string) => checkStored(url, label),
}));
vi.mock("@/lib/image-client", () => ({ compressImage: async (f: File) => f }));

import { PhotoPicker } from "@/components/listings/PhotoPicker";

const STORED = "https://x.supabase.co/storage/v1/object/public/listing-photos/u1/new.jpg";

beforeEach(() => {
  check.mockReset();
  checkStored.mockReset();
  Object.assign(URL, { createObjectURL: () => "blob:preview", revokeObjectURL: () => {} });
});
afterEach(cleanup);

const submitted = (name: string) =>
  Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)).map((i) => i.value);

/** The (label, file name) the picker sent to the server on call `n`. */
const sent = (n = 0) => {
  const body = check.mock.calls[n][0];
  return { label: body.get("label"), name: (body.get("photo") as File).name };
};

async function addPhoto(name: string) {
  const file = new File(["x"], name, { type: "image/jpeg" });
  await userEvent.upload(screen.getByLabelText(/add photos/i), file);
}

test("a photo is sent to the server with its tag, and stored only by the server", async () => {
  check.mockResolvedValue({ ok: true, url: STORED, checked: true, subject: "bathroom", reason: "A shower.", token: "bathroom.abc" });
  render(<PhotoPicker initialUrls={[]} initialLabels={[]} />);
  await addPhoto("shower.jpg");
  await waitFor(() => expect(submitted("existing_photos")).toEqual([STORED]));
  expect(sent()).toEqual({ label: "bathroom", name: "shower.jpg" });
  expect(submitted("existing_labels")).toEqual(["bathroom"]);
  expect(submitted("photo_tokens")).toEqual(["bathroom.abc"]);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a photo that isn't of the apartment is taken straight back out, with a line saying why", async () => {
  check.mockResolvedValue({
    ok: false, rejected: true, subject: "not_apartment",
    reason: "A dog on a rug is the subject here.",
    message: "This isn't a photo of the apartment — please upload a photo of a living room instead.",
  });
  render(<PhotoPicker initialUrls={[]} initialLabels={[]} />);
  await addPhoto("living-room.jpg");
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Removed living-room\.jpg/));
  expect(screen.getByRole("alert")).toHaveTextContent(/A dog on a rug is the subject here\./);
  expect(screen.getByRole("alert")).toHaveTextContent(/Only photos of the apartment are accepted/);
  // The tile itself is gone: no photo, no tag select, nothing to submit.
  expect(screen.queryByLabelText(/room shown in photo 1/i)).toBeNull();
  expect(screen.getByText(/^0\/10 photos/)).toBeInTheDocument();
  expect(submitted("existing_photos")).toEqual([]);
  expect(document.querySelector('input[name="photos_flagged"]')).toBeNull();
});

test("a bedroom photo tagged 'Living room' is refused, keeps its tile, and passes once re-tagged", async () => {
  check.mockResolvedValue({
    ok: false, rejected: true, subject: "bedroom", reason: "A bed fills the frame.",
    message: "This looks like a bedroom, not a living room — tag it as Bedroom or upload a photo of a living room.",
  });
  render(<PhotoPicker initialUrls={[]} initialLabels={[]} />);
  await addPhoto("living-room.jpg");

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/looks like a bedroom, not a living room/));
  expect(submitted("existing_photos")).toEqual([]); // never stored
  expect(submitted("photos_flagged")).toEqual(["1"]);
  expect(screen.getByLabelText(/room shown in photo 1/i)).toHaveValue("living_room");

  // The member moves it to Bedroom: the same file is checked again, and passes.
  check.mockResolvedValue({ ok: true, url: STORED, checked: true, subject: "bedroom", reason: "A bed.", token: "bedroom.abc" });
  await userEvent.selectOptions(screen.getByLabelText(/room shown in photo 1/i), "bedroom");
  await waitFor(() => expect(submitted("existing_photos")).toEqual([STORED]));
  expect(sent(1)).toEqual({ label: "bedroom", name: "living-room.jpg" });
  expect(submitted("photo_tokens")).toEqual(["bedroom.abc"]);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("every tag is strict now: a kitchen photo tagged Balcony is refused too", async () => {
  check.mockResolvedValue({
    ok: false, rejected: true, subject: "kitchen", reason: "Cabinets and a stove.",
    message: "This looks like a kitchen, not a balcony — tag it as Kitchen or upload a photo of a balcony.",
  });
  render(<PhotoPicker initialUrls={[]} initialLabels={[]} />);
  await addPhoto("balcony.jpg");
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/looks like a kitchen, not a balcony/));
  expect(sent()).toEqual({ label: "balcony", name: "balcony.jpg" });
  expect(submitted("existing_photos")).toEqual([]);
});

test("a photo whose name says nothing waits for a room, and is not sent until it has one", async () => {
  render(<PhotoPicker initialUrls={[]} initialLabels={[]} />);
  await addPhoto("IMG_4821.jpg");
  await waitFor(() => expect(screen.getByText(/Pick the room this photo shows/)).toBeInTheDocument());
  expect(check).not.toHaveBeenCalled(); // nothing sent while the room is unknown
  expect(submitted("photos_flagged")).toEqual(["1"]);

  check.mockResolvedValue({ ok: true, url: STORED, checked: true, subject: "kitchen", reason: "A stove.", token: "kitchen.abc" });
  await userEvent.selectOptions(screen.getByLabelText(/room shown in photo 1/i), "kitchen");
  await waitFor(() => expect(submitted("existing_labels")).toEqual(["kitchen"]));
  expect(sent()).toEqual({ label: "kitchen", name: "IMG_4821.jpg" });
});

test("the removal line names each bad photo and clears when the member tries again", async () => {
  check.mockResolvedValue({
    ok: false, rejected: true, subject: "not_apartment", reason: "A plate of food.",
    message: "This isn't a photo of the apartment — please upload a photo of a bedroom instead.",
  });
  render(<PhotoPicker initialUrls={[]} initialLabels={[]} />);
  await addPhoto("bed-dinner.jpg");
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Removed bed-dinner\.jpg/));
  check.mockResolvedValue({ ok: true, url: STORED, checked: true, subject: "bathroom", reason: "A shower.", token: "bathroom.abc" });
  await addPhoto("shower.jpg");
  await waitFor(() => expect(submitted("photo_tokens")).toEqual(["bathroom.abc"]));
  expect(screen.queryByRole("alert")).toBeNull(); // the old line went with the new attempt
});

test("forcing a checked photo onto the wrong tag flags it and blocks the form, with no second call", async () => {
  check.mockResolvedValue({ ok: true, url: STORED, checked: true, subject: "bedroom", reason: "A bed.", token: "bedroom.abc" });
  render(<PhotoPicker initialUrls={[]} initialLabels={[]} />);
  await addPhoto("bedroom.jpg");
  await waitFor(() => expect(submitted("photo_tokens")).toEqual(["bedroom.abc"]));
  await userEvent.selectOptions(screen.getByLabelText(/room shown in photo 1/i), "kitchen");
  expect(screen.getByRole("alert")).toHaveTextContent(/looks like a bedroom, not a kitchen/);
  expect(submitted("existing_photos")).toEqual([]); // not submitted while flagged
  expect(document.querySelector('input[name="photos_flagged"]')).not.toBeNull();
  expect(check).toHaveBeenCalledTimes(1); // the stored verdict is reused, not re-asked
});

test("re-tagging a photo saved before the check existed asks for a verdict, which can refuse it", async () => {
  const old = "https://x.supabase.co/storage/v1/object/public/listing-photos/u1/old.jpg";
  render(<PhotoPicker initialUrls={[old]} initialLabels={["kitchen"]} />);
  expect(submitted("photo_tokens")).toEqual([""]); // trusted by the server as a saved pair

  checkStored.mockResolvedValue({
    ok: false, rejected: true, subject: "kitchen", reason: "Cabinets and a stove.",
    message: "This looks like a kitchen, not a bathroom — tag it as Kitchen or upload a photo of a bathroom.",
  });
  await userEvent.selectOptions(screen.getByLabelText(/room shown in photo 1/i), "bathroom");
  await waitFor(() => expect(checkStored).toHaveBeenCalledWith(old, "bathroom"));
  expect(screen.getByRole("alert")).toHaveTextContent(/looks like a kitchen, not a bathroom/);
  expect(submitted("existing_photos")).toEqual([]);

  checkStored.mockResolvedValue({ ok: true, url: old, checked: true, subject: "kitchen", reason: "A stove.", token: "kitchen.abc" });
  await userEvent.selectOptions(screen.getByLabelText(/room shown in photo 1/i), "kitchen");
  await waitFor(() => expect(submitted("photo_tokens")).toEqual(["kitchen.abc"]));
});

test("Other is not offered when adding a photo, but a photo saved under it keeps it", async () => {
  const legacy = "https://x.supabase.co/storage/v1/object/public/listing-photos/u1/hall.jpg";
  render(<PhotoPicker initialUrls={[legacy]} initialLabels={["other"]} />);
  const select = screen.getByLabelText(/room shown in photo 1/i);
  expect(select).toHaveValue("other"); // the saved tag is not rewritten behind the member's back
  const offered = Array.from(select.querySelectorAll("option"))
    .filter((o) => !(o as HTMLOptionElement).disabled)
    .map((o) => (o as HTMLOptionElement).value);
  expect(offered).toEqual(["living_room", "bedroom", "bathroom", "kitchen", "balcony", "exterior", "other"]);

  // A fresh photo gets no "Other" anywhere in its list.
  await addPhoto("IMG_4821.jpg");
  const fresh = screen.getByLabelText(/room shown in photo 2/i);
  expect(fresh).toHaveValue("");
  expect(Array.from(fresh.querySelectorAll("option")).map((o) => (o as HTMLOptionElement).value)).not.toContain("other");
});

test("when the check is switched off photos are stored and simply go through", async () => {
  check.mockResolvedValue({ ok: true, url: STORED, checked: false });
  render(<PhotoPicker initialUrls={[]} initialLabels={[]} />);
  await addPhoto("bath.jpg");
  await waitFor(() => expect(submitted("existing_labels")).toEqual(["bathroom"]));
  expect(submitted("photo_tokens")).toEqual([""]);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a server error leaves the photo out and says so", async () => {
  check.mockResolvedValue({ ok: false, rejected: false, error: "We couldn't check this photo right now — please try again in a moment." });
  render(<PhotoPicker initialUrls={[]} initialLabels={[]} />);
  await addPhoto("bath.jpg");
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/couldn't check this photo right now/));
  expect(submitted("existing_photos")).toEqual([]);
});
