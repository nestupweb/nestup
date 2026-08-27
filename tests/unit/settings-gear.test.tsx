import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

afterEach(cleanup);
import { SettingsLink } from "@/components/ui/GearIcon";

describe("SettingsLink", () => {
  test("links to /settings and is labelled for screen readers", () => {
    render(<SettingsLink />);
    const link = screen.getByRole("link", { name: /settings/i });
    expect(link).toHaveAttribute("href", "/settings");
  });
});
