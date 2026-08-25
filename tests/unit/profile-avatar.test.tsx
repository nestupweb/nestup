import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ProfileAvatar, fullSizeUrl } from "@/components/profile/ProfileAvatar";

afterEach(cleanup);

const PHOTO = "https://example.com/storage/v1/object/public/avatars/me/pic.jpg";

test("clicking the picture opens it full-size; Escape and the close button dismiss it", () => {
  render(<ProfileAvatar url={PHOTO} name="Noa Peretz" />);
  expect(screen.queryByRole("dialog")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "View profile photo" }));
  const dialog = screen.getByRole("dialog", { name: "Noa Peretz's profile photo" });
  expect(dialog.querySelector("img")).toHaveAttribute("src", PHOTO);

  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "View profile photo" }));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("the pencil overlay links to the edit page without opening the full-size view", () => {
  render(<ProfileAvatar url={PHOTO} name="Noa Peretz" />);
  const pencil = screen.getByRole("link", { name: "Edit profile" });
  expect(pencil).toHaveAttribute("href", "/profile/edit");
  expect(pencil).not.toHaveAttribute("target");
  expect(pencil.className).toContain("group-hover:opacity-100");
  // The pencil is a plain link, so it can't be what opens the lightbox.
  expect(pencil.tagName).toBe("A");
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("without a photo, the placeholder and the pencil both lead to the editor", () => {
  render(<ProfileAvatar url={null} name="Noa Peretz" />);
  expect(screen.getByRole("link", { name: "Add a profile photo" })).toHaveAttribute("href", "/profile/edit");
  expect(screen.getByRole("link", { name: "Edit profile" })).toHaveAttribute("href", "/profile/edit");
  expect(screen.queryByRole("button", { name: "View profile photo" })).toBeNull();
});

test("fullSizeUrl asks Unsplash for a large render and leaves other hosts alone", () => {
  expect(fullSizeUrl("https://images.unsplash.com/photo-1?w=256&h=256&fit=crop&crop=faces&q=80")).toBe(
    "https://images.unsplash.com/photo-1?w=1200&q=80"
  );
  expect(fullSizeUrl(PHOTO)).toBe(PHOTO);
  expect(fullSizeUrl("/relative.jpg")).toBe("/relative.jpg");
});
