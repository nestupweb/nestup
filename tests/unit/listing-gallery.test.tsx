import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

// No `globals: true` in vitest config, so RTL's automatic cleanup never registers.
afterEach(cleanup);

// next/image needs the Next runtime; render a plain <img> with the same src/alt.
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={String(src)} alt={String(alt ?? "")} />;
  },
}));

import { ListingGallery } from "@/components/listings/ListingGallery";

const photos = [
  "https://example.com/a.jpg",
  "https://example.com/b.jpg",
  "https://example.com/c.jpg",
];

test("renders the first photo with a 1/3 counter", () => {
  render(<ListingGallery photos={photos} title="Test room" />);
  expect(screen.getByRole("img")).toHaveAttribute("src", photos[0]);
  expect(screen.getByText("1/3")).toBeInTheDocument();
});

test("next arrow advances to the second photo", async () => {
  render(<ListingGallery photos={photos} title="Test room" />);
  await userEvent.click(screen.getByRole("button", { name: /next photo/i }));
  expect(screen.getByText("2/3")).toBeInTheDocument();
  expect(screen.getByRole("img")).toHaveAttribute("src", photos[1]);
});

test("previous from the first photo wraps around to the last", async () => {
  render(<ListingGallery photos={photos} title="Test room" />);
  await userEvent.click(screen.getByRole("button", { name: /previous photo/i }));
  expect(screen.getByText("3/3")).toBeInTheDocument();
  expect(screen.getByRole("img")).toHaveAttribute("src", photos[2]);
});

test("a single photo renders no arrow buttons", () => {
  render(<ListingGallery photos={[photos[0]]} title="Test room" />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByText("1/1")).toBeInTheDocument();
});
