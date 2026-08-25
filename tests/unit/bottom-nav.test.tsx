import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { BottomNav } from "@/components/ui/BottomNav";

const pathname = vi.hoisted(() => ({ value: "/browse" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

beforeEach(() => {
  pathname.value = "/browse";
});
afterEach(cleanup);

test("renders the four destinations and marks the current one", () => {
  render(<BottomNav />);
  const links = screen.getAllByRole("link");
  expect(links.map((l) => l.textContent)).toEqual(["Swipe", "Listings", "Chat", "Profile"]);
  expect(links.map((l) => l.getAttribute("href"))).toEqual(["/swipe", "/browse", "/chat", "/profile"]);
  expect(screen.getByRole("link", { name: "Listings" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Chat" })).not.toHaveAttribute("aria-current");
});

test("nested routes keep their tab active", () => {
  pathname.value = "/browse/some-listing";
  render(<BottomNav />);
  expect(screen.getByRole("link", { name: "Listings" })).toHaveAttribute("aria-current", "page");
});

test("shows the unread badge on Chat only when there is something unread", () => {
  const { unmount } = render(<BottomNav unread={0} />);
  expect(screen.queryByLabelText(/unread/)).toBeNull();
  unmount();
  render(<BottomNav unread={3} />);
  expect(screen.getByLabelText("3 unread")).toHaveTextContent("3");
});

test("hides itself on small screens inside an open chat thread", () => {
  pathname.value = "/chat/123e4567-e89b-12d3-a456-426614174000";
  render(<BottomNav />);
  expect(screen.getByRole("navigation", { name: "Primary" }).className).toContain("hidden lg:flex");
});
