import { expect, test } from "vitest";
import { TAB_ORDER, navTransitionTypes, tabIndex } from "@/lib/nav-direction";

test("tab order matches the bottom nav left→right", () => {
  expect(TAB_ORDER).toEqual(["/swipe", "/browse", "/chat", "/profile"]);
});

test("tabIndex resolves nested routes to their tab and -1 elsewhere", () => {
  expect(tabIndex("/browse")).toBe(1);
  expect(tabIndex("/browse/abc")).toBe(1);
  expect(tabIndex("/chat/123")).toBe(2);
  expect(tabIndex("/profile/edit")).toBe(3);
  expect(tabIndex("/browsers")).toBe(-1);
  expect(tabIndex("/")).toBe(-1);
  expect(tabIndex("/listing")).toBe(-1);
});

test("moving right is forward, moving left is back", () => {
  expect(navTransitionTypes("/swipe", "/browse")).toEqual(["nav-forward"]);
  expect(navTransitionTypes("/browse/abc", "/profile")).toEqual(["nav-forward"]);
  expect(navTransitionTypes("/profile", "/chat")).toEqual(["nav-back"]);
  expect(navTransitionTypes("/chat/123", "/swipe")).toEqual(["nav-back"]);
});

test("same tab or a non-tab page carries no direction", () => {
  expect(navTransitionTypes("/browse", "/browse")).toEqual([]);
  expect(navTransitionTypes("/browse/abc", "/browse")).toEqual([]);
  expect(navTransitionTypes("/listing", "/profile")).toEqual([]);
  expect(navTransitionTypes("/", "/browse")).toEqual([]);
});
