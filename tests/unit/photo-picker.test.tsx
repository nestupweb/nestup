import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { PhotoCheckResult } from "@/app/actions/photo-check";
import type { LocalPhotoVerdict } from "@/lib/photo-detect";

const check = vi.fn<(url: string, label: string) => Promise<PhotoCheckResult>>();
const inspect = vi.fn<(file: File) => Promise<LocalPhotoVerdict>>();
const remove = vi.fn(async () => ({ data: null, error: null }));
const upload = vi.fn(async () => ({ data: null, error: null }));

vi.mock("@/app/actions/photo-check", () => ({ checkListingPhotoAction: (u: string, l: string) => check(u, l) }));
vi.mock("@/lib/photo-detect", () => ({ inspectPhoto: (f: File) => inspect(f), warmUpPhotoCheck: () => {} }));
vi.mock("@/lib/image-client", () => ({ compressImage: async (f: File) => f }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload,
        remove,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/listing-photos/${path}` } }),
      }),
    },
  }),
}));

import { PhotoPicker } from "@/components/listings/PhotoPicker";

beforeEach(() => {
  check.mockReset();
  inspect.mockReset();
  inspect.mockResolvedValue({ kind: "unsure" });
  remove.mockClear();
  upload.mockClear();
  Object.assign(URL, { createObjectURL: () => "blob:preview", revokeObjectURL: () => {} });
});
afterEach(cleanup);

const submitted = (name: string) =>
  Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)).map((i) => i.value);

async function addPhoto(name: string) {
  const file = new File(["x"], name, { type: "image/jpeg" });
  await userEvent.upload(screen.getByLabelText(/add photos/i), file);
}

test("the browser check turns a dog photo away before it is ever uploaded", async () => {
  inspect.mockResolvedValue({ kind: "reject", reason: "A dog is the main thing in this photo." });
  render(<PhotoPicker userId="u1" initialUrls={[]} initialLabels={[]} />);
  await addPhoto("living-room.jpg");
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Removed living-room\.jpg/));
  expect(screen.getByRole("alert")).toHaveTextContent(/A dog is the main thing in this photo\./);
  expect(screen.getByRole("alert")).toHaveTextContent(/Only photos of the apartment are accepted/);
  expect(upload).not.toHaveBeenCalled(); // never reached storage
  expect(check).not.toHaveBeenCalled();
  expect(screen.queryByLabelText(/room shown in photo 1/i)).toBeNull();
  expect(submitted("existing_photos")).toEqual([]);
});

test("the browser check re-tags a bedroom photo that was named living room", async () => {
  inspect.mockResolvedValue({ kind: "room", room: "bedroom" });
  check.mockResolvedValue({ ok: true, checked: false });
  render(<PhotoPicker userId="u1" initialUrls={[]} initialLabels={[]} />);
  await addPhoto("living-room.jpg");
  await waitFor(() => expect(screen.getByLabelText(/room shown in photo 1/i)).toHaveValue("bedroom"));
  expect(screen.getByText(/Tagged as Bedroom/)).toBeInTheDocument();
  expect(check).toHaveBeenCalledWith(expect.any(String), "bedroom"); // the server is told the corrected tag
  expect(submitted("existing_labels")).toEqual(["bedroom"]);
});

test("a photo the browser check can't read still goes through", async () => {
  inspect.mockResolvedValue({ kind: "unsure" });
  check.mockResolvedValue({ ok: true, checked: false });
  render(<PhotoPicker userId="u1" initialUrls={[]} initialLabels={[]} />);
  await addPhoto("shower.jpg");
  await waitFor(() => expect(submitted("existing_labels")).toEqual(["bathroom"]));
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a photo that isn't of the apartment is taken straight back out, with a line saying why", async () => {
  check.mockResolvedValue({ ok: true, checked: true, subject: "not_apartment", reason: "A dog on a rug is the subject here.", token: "x" });
  render(<PhotoPicker userId="u1" initialUrls={[]} initialLabels={[]} />);
  await addPhoto("living-room.jpg");
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Removed living-room\.jpg/));
  expect(screen.getByRole("alert")).toHaveTextContent(/A dog on a rug is the subject here\./);
  expect(screen.getByRole("alert")).toHaveTextContent(/Only photos of the apartment are accepted/);
  expect(check).toHaveBeenCalledWith(expect.stringContaining("/listing-photos/u1/"), "living_room");
  expect(remove).toHaveBeenCalledTimes(1); // gone from the bucket too
  // The tile itself is gone: no photo, no tag select, nothing to submit.
  expect(screen.queryByLabelText(/room shown in photo 1/i)).toBeNull();
  expect(screen.getByText(/^0\/10 photos/)).toBeInTheDocument();
  expect(submitted("existing_photos")).toEqual([]);
  expect(document.querySelector('input[name="photos_flagged"]')).toBeNull();
});

test("the removal line names each bad photo and clears when the member tries again", async () => {
  check.mockResolvedValue({ ok: true, checked: true, subject: "not_apartment", reason: "A plate of food.", token: "x" });
  render(<PhotoPicker userId="u1" initialUrls={[]} initialLabels={[]} />);
  await addPhoto("dinner.jpg");
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Removed dinner\.jpg/));
  check.mockResolvedValue({ ok: true, checked: true, subject: "bathroom", reason: "A shower and a sink.", token: "bathroom.abc" });
  await addPhoto("shower.jpg");
  await waitFor(() => expect(submitted("photo_tokens")).toEqual(["bathroom.abc"]));
  expect(screen.queryByRole("alert")).toBeNull(); // the old line went with the new attempt
});

test("a bedroom photo named 'living room' is retagged as Bedroom and submitted with its token", async () => {
  check.mockResolvedValue({ ok: true, checked: true, subject: "bedroom", reason: "A bed fills the frame.", token: "bedroom.abc" });
  render(<PhotoPicker userId="u1" initialUrls={[]} initialLabels={[]} />);
  await addPhoto("living-room.jpg");
  await waitFor(() => expect(screen.getByLabelText(/room shown in photo 1/i)).toHaveValue("bedroom"));
  expect(screen.getByText(/Tagged as Bedroom/)).toBeInTheDocument();
  expect(submitted("existing_labels")).toEqual(["bedroom"]);
  expect(submitted("photo_tokens")).toEqual(["bedroom.abc"]);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(document.querySelector('input[name="photos_flagged"]')).toBeNull();
});

test("forcing a checked bedroom photo back to 'Living room' flags it and blocks the form", async () => {
  check.mockResolvedValue({ ok: true, checked: true, subject: "bedroom", reason: "A bed fills the frame.", token: "bedroom.abc" });
  render(<PhotoPicker userId="u1" initialUrls={[]} initialLabels={[]} />);
  await addPhoto("bedroom.jpg");
  await waitFor(() => expect(submitted("photo_tokens")).toEqual(["bedroom.abc"]));
  await userEvent.selectOptions(screen.getByLabelText(/room shown in photo 1/i), "living_room");
  expect(screen.getByRole("alert")).toHaveTextContent(/looks like a bedroom, not a living room/);
  expect(submitted("existing_photos")).toEqual([]); // not submitted while flagged
  expect(document.querySelector('input[name="photos_flagged"]')).not.toBeNull();
  expect(check).toHaveBeenCalledTimes(1); // no second look — the verdict is reused
  // Kitchen is a "just an apartment photo" tag, so the same verdict lets it through.
  await userEvent.selectOptions(screen.getByLabelText(/room shown in photo 1/i), "kitchen");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(submitted("existing_labels")).toEqual(["kitchen"]);
});

test("re-tagging a photo saved before the check existed asks for a verdict, which wins", async () => {
  const old = "https://x.supabase.co/storage/v1/object/public/listing-photos/u1/old.jpg";
  check.mockResolvedValue({ ok: true, checked: true, subject: "kitchen", reason: "Cabinets and a stove.", token: "kitchen.abc" });
  render(<PhotoPicker userId="u1" initialUrls={[old]} initialLabels={["kitchen"]} />);
  expect(submitted("photo_tokens")).toEqual([""]); // trusted by the server as a saved pair
  await userEvent.selectOptions(screen.getByLabelText(/room shown in photo 1/i), "bathroom");
  await waitFor(() => expect(check).toHaveBeenCalledWith(old, "bathroom"));
  // The photo shows a kitchen, so "Bathroom" doesn't stick: back to Kitchen, now with a verdict.
  await waitFor(() => expect(screen.getByLabelText(/room shown in photo 1/i)).toHaveValue("kitchen"));
  expect(screen.getByText(/Tagged as Kitchen/)).toBeInTheDocument();
  expect(submitted("photo_tokens")).toEqual(["kitchen.abc"]);
});

test("an unidentifiable interior loses its wrong tag and waits for the member to say the room", async () => {
  check.mockResolvedValue({ ok: true, checked: true, subject: "other_apartment", reason: "A hallway.", token: "other_apartment.abc" });
  render(<PhotoPicker userId="u1" initialUrls={[]} initialLabels={[]} />);
  await addPhoto("shower.jpg"); // guessed as Bathroom from the name
  // There is no "Other" to file it under any more: the tag is cleared and the tile asks.
  await waitFor(() => expect(screen.getByLabelText(/room shown in photo 1/i)).toHaveValue(""));
  expect(screen.getByText(/couldn't see a bathroom here/)).toBeInTheDocument();
  expect(screen.getByText(/Pick the room this photo shows/)).toBeInTheDocument();
  expect(submitted("existing_labels")).toEqual([]); // held back until it is tagged
  expect(submitted("photos_flagged")).toEqual(["1"]);

  // Once the member says which room it is, it goes through under that tag.
  await userEvent.selectOptions(screen.getByLabelText(/room shown in photo 1/i), "kitchen");
  await waitFor(() => expect(submitted("existing_labels")).toEqual(["kitchen"]));
  expect(submitted("photo_tokens")).toEqual(["other_apartment.abc"]);
});

test("Other is not offered when adding a photo, but a photo saved under it keeps it", async () => {
  const legacy = "https://x.supabase.co/storage/v1/object/public/listing-photos/u1/hall.jpg";
  check.mockResolvedValue({ ok: true, checked: false });
  render(<PhotoPicker userId="u1" initialUrls={[legacy]} initialLabels={["other"]} />);
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

test("when the check is switched off photos simply go through", async () => {
  check.mockResolvedValue({ ok: true, checked: false });
  render(<PhotoPicker userId="u1" initialUrls={[]} initialLabels={[]} />);
  await addPhoto("bath.jpg");
  await waitFor(() => expect(submitted("existing_labels")).toEqual(["bathroom"]));
  expect(submitted("photo_tokens")).toEqual([""]);
});
