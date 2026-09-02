import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("@/components/ui/GearIcon", () => ({ SettingsLink: () => <a href="/settings">Settings</a> }));

import { MemberActions } from "@/components/ui/MemberActions";

afterEach(cleanup);

/**
 * The header's Log out button, and the one thing about it that is not visible:
 * where it posts.
 *
 * It used to call a Server Action that ended in `redirect("/")`. That is a soft
 * navigation, so the member's cached deck, inbox and profile tabs — and the
 * router's rendered copies of those pages — stayed in the tab after the session
 * ended. It now posts to `/auth/signout`, which answers 303 and forces a full
 * document load; that load is what empties them.
 *
 * Nothing about this is apparent on screen, so a future refactor back to a
 * Server Action would look like a tidy-up and quietly restore the leak. Hence
 * the assertion on the form's target.
 */
test("Log out posts to the signout route, not a Server Action", () => {
  render(<MemberActions />);

  const button = screen.getByRole("button", { name: "Log out" });
  const form = button.closest("form");

  expect(form).toHaveAttribute("action", "/auth/signout");
  expect(form?.getAttribute("method")?.toLowerCase()).toBe("post");
});

/** The gear keeps its place beside it — this component is the pair, not the button alone. */
test("the settings link sits alongside Log out", () => {
  render(<MemberActions />);
  expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
});
