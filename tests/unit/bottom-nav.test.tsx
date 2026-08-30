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

test("every destination navigates in the same tab through the client-side router", () => {
  render(<BottomNav />);
  const links = screen.getAllByRole("link");
  expect(links).toHaveLength(4);
  for (const link of links) {
    // Internal, relative routes handled by next/link — never a new window.
    expect(link.getAttribute("href")).toMatch(/^\/[a-z]/);
    expect(link).not.toHaveAttribute("target");
    expect(link).not.toHaveAttribute("rel");
    expect(link).not.toHaveAttribute("onclick");
  }
});

test("nested routes keep their tab active", () => {
  pathname.value = "/browse/some-listing";
  render(<BottomNav />);
  expect(screen.getByRole("link", { name: "Listings" })).toHaveAttribute("aria-current", "page");
});

const badge = (n: number) => <span aria-label={`${n} unread`}>{n}</span>;

test("renders the unread slot inside the Chat link and nowhere else", () => {
  render(<BottomNav unreadSlot={badge(3)} />);
  const chat = screen.getByRole("link", { name: /Chat/ });
  expect(screen.getByLabelText("3 unread")).toHaveTextContent("3");
  expect(chat).toContainElement(screen.getByLabelText("3 unread"));
});

/**
 * The count comes from an extra RPC the layout no longer awaits — it passes a
 * suspended slot instead, so the nav has to be complete and usable while that
 * slot is still empty. This is the regression guard for that: no slot, still
 * four working links.
 */
test("the nav is complete while the unread slot is still pending", () => {
  render(<BottomNav />);
  expect(screen.getAllByRole("link")).toHaveLength(4);
  expect(screen.queryByLabelText(/unread/)).toBeNull();
  expect(screen.getByRole("link", { name: /Chat/ })).toHaveAttribute("href", "/chat");
});

test("hides itself on small screens inside an open chat thread", () => {
  pathname.value = "/chat/123e4567-e89b-12d3-a456-426614174000";
  render(<BottomNav />);
  expect(screen.getByRole("navigation", { name: "Primary" }).className).toContain("hidden lg:flex");
});

// Mounted from the root layout now, so it renders on every route — including
// the (auth) pages, which have no bottom padding to keep it off their content.
test("stays off the auth pages, and on every page that is not one", () => {
  for (const p of ["/login", "/signup", "/forgot-password", "/reset-password", "/verify"]) {
    cleanup();
    pathname.value = p;
    render(<BottomNav />);
    expect(screen.queryByRole("navigation"), p).toBeNull();
  }
  for (const p of ["/browse", "/browse/l1", "/swipe", "/chat", "/profile", "/settings", "/listing", "/"]) {
    cleanup();
    pathname.value = p;
    render(<BottomNav />);
    expect(screen.queryByRole("navigation"), p).not.toBeNull();
  }
});
