import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { canGoBack, parentPath } from "@/lib/back";

const router = { back: vi.fn(), push: vi.fn() };
let pathname = "/browse/abc";
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => pathname }));

import { BackButton } from "@/components/ui/BackButton";

afterEach(() => {
  cleanup();
  router.back.mockClear();
  router.push.mockClear();
  delete (window as unknown as { navigation?: unknown }).navigation;
});

describe("parentPath", () => {
  test("detail pages fall back to their list, tabs to Listings, Listings and auth to the landing page", () => {
    expect(parentPath("/browse/123")).toBe("/browse");
    expect(parentPath("/chat/123")).toBe("/chat");
    expect(parentPath("/profile/edit")).toBe("/profile");
    expect(parentPath("/people/123")).toBe("/swipe");
    expect(parentPath("/listing")).toBe("/profile");
    expect(parentPath("/swipe")).toBe("/browse");
    expect(parentPath("/chat")).toBe("/browse");
    expect(parentPath("/profile")).toBe("/browse");
    expect(parentPath("/browse")).toBe("/");
    expect(parentPath("/login")).toBe("/");
    expect(parentPath("/signup")).toBe("/");
    expect(parentPath("/")).toBe("/");
  });
});

describe("canGoBack", () => {
  test("prefers the Navigation API and falls back to history length", () => {
    expect(canGoBack({ navigation: { canGoBack: true }, history: { length: 1 } })).toBe(true);
    expect(canGoBack({ navigation: { canGoBack: false }, history: { length: 5 } })).toBe(false);
    expect(canGoBack({ history: { length: 1 } })).toBe(false);
    expect(canGoBack({ history: { length: 2 } })).toBe(true);
  });
});

describe("BackButton", () => {
  test("goes back when there is a previous page", () => {
    (window as unknown as { navigation: unknown }).navigation = { canGoBack: true };
    render(<BackButton />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  test("goes to the parent page when there is nothing to go back to", () => {
    (window as unknown as { navigation: unknown }).navigation = { canGoBack: false };
    render(<BackButton />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.push).toHaveBeenCalledWith("/browse");
    expect(router.back).not.toHaveBeenCalled();
  });

  test("is hidden on Listings (the front door) only when there is no history", async () => {
    pathname = "/browse";
    (window as unknown as { navigation: unknown }).navigation = { canGoBack: false };
    const { unmount } = render(<BackButton />);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Back" })).toBeNull());
    unmount();

    (window as unknown as { navigation: unknown }).navigation = { canGoBack: true };
    render(<BackButton />);
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    pathname = "/browse/abc";
  });
});
