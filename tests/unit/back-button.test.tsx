import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { canGoBack, markGoingBack, pageName, parentPath, previousVisit, recordVisit, resetTrail } from "@/lib/back";

const router = { back: vi.fn(), push: vi.fn() };
let pathname = "/browse/abc";
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => pathname }));

import { BackButton } from "@/components/ui/BackButton";

beforeEach(() => resetTrail());
afterEach(() => {
  cleanup();
  router.back.mockClear();
  router.push.mockClear();
  delete (window as unknown as { navigation?: unknown }).navigation;
  pathname = "/browse/abc";
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
    expect(parentPath("/")).toBe("/");
  });
});

describe("pageName", () => {
  test("names every page the way the label reads", () => {
    expect(pageName("/")).toBe("listings");
    expect(pageName("/browse")).toBe("listings");
    expect(pageName("/browse/123")).toBe("room");
    expect(pageName("/swipe")).toBe("swipe");
    expect(pageName("/chat")).toBe("chats");
    expect(pageName("/chat/123")).toBe("chat");
    expect(pageName("/profile")).toBe("profile");
    expect(pageName("/profile/edit")).toBe("edit profile");
    expect(pageName("/people/123")).toBe("profile");
    expect(pageName("/listing")).toBe("listing form");
    expect(pageName("/login")).toBe("log in");
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

describe("the in-app trail", () => {
  test("remembers where the tab came from, before and after the visit is recorded", () => {
    recordVisit("/chat");
    expect(previousVisit("/chat")).toBeNull();
    // Navigating to a thread: the label is right even before the effect records it.
    expect(previousVisit("/chat/1")).toBe("/chat");
    recordVisit("/chat/1");
    expect(previousVisit("/chat/1")).toBe("/chat");
  });

  test("a step back pops the trail instead of growing it", () => {
    recordVisit("/profile");
    recordVisit("/browse/1");
    markGoingBack();
    expect(previousVisit("/profile")).toBeNull();
    recordVisit("/profile");
    expect(previousVisit("/profile")).toBeNull();
    expect(sessionStorage.getItem("nestup:nav-trail")).toBe(JSON.stringify(["/profile"]));
  });

  test("survives a reload through sessionStorage", () => {
    sessionStorage.setItem("nestup:nav-trail", JSON.stringify(["/swipe", "/people/9"]));
    resetTrail();
    sessionStorage.setItem("nestup:nav-trail", JSON.stringify(["/swipe", "/people/9"]));
    // resetTrail cleared the in-memory copy; the next read loads from storage.
    expect(previousVisit("/people/9")).toBe("/swipe");
  });
});

describe("BackButton", () => {
  test("names the page the tab came from and goes back through history", async () => {
    recordVisit("/chat");
    pathname = "/chat/123";
    (window as unknown as { navigation: unknown }).navigation = { canGoBack: true };
    render(<BackButton />);
    const button = await screen.findByRole("button", { name: "Back to chats" });
    fireEvent.click(button);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  test("on a direct link it names and opens the parent page", async () => {
    pathname = "/profile/edit";
    (window as unknown as { navigation: unknown }).navigation = { canGoBack: false };
    render(<BackButton />);
    fireEvent.click(await screen.findByRole("button", { name: "Back to profile" }));
    expect(router.push).toHaveBeenCalledWith("/profile");
    expect(router.back).not.toHaveBeenCalled();
  });

  test("Listings hides it unless the tab came from somewhere", async () => {
    pathname = "/browse";
    const { unmount } = render(<BackButton />);
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
    unmount();
    resetTrail();
    recordVisit("/profile");
    render(<BackButton />);
    expect(await screen.findByRole("button", { name: "Back to profile" })).toBeInTheDocument();
  });
});
