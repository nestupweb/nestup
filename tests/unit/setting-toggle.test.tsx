import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(cleanup);
import { SettingToggle } from "@/components/settings/SettingToggle";

describe("SettingToggle", () => {
  test("flips optimistically and calls the action", async () => {
    const save = vi.fn().mockResolvedValue({});
    render(<SettingToggle label="Show my phone" checked={false} onSave={save} />);
    const box = screen.getByRole("switch", { name: /show my phone/i });
    expect(box).toHaveAttribute("aria-checked", "false");
    await userEvent.click(box);
    expect(save).toHaveBeenCalledWith(true);
    expect(box).toHaveAttribute("aria-checked", "true");
  });

  test("reverts and explains when the save fails", async () => {
    const save = vi.fn().mockResolvedValue({ error: "Could not save." });
    render(<SettingToggle label="Show my phone" checked onSave={save} />);
    const box = screen.getByRole("switch", { name: /show my phone/i });
    await userEvent.click(box);
    expect(await screen.findByText("Could not save.")).toBeInTheDocument();
    expect(box).toHaveAttribute("aria-checked", "true");
  });
});
