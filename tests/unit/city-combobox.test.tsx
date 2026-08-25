import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CityCombobox } from "@/components/ui/CityCombobox";
import { CITIES } from "@/lib/cities";

describe("CityCombobox", () => {
  afterEach(cleanup);

  test("the chevron opens every city A–Z, grouped by letter, and a click picks one", async () => {
    const onSelect = vi.fn();
    render(<CityCombobox name="city" defaultValue="Tel Aviv" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: /browse all cities/i }));

    const list = screen.getByRole("listbox", { name: /all cities/i });
    expect(list).toHaveTextContent(`All cities · ${CITIES.length}`);
    expect(screen.getAllByRole("option")).toHaveLength(CITIES.length);
    // Letter headers are decorative — hidden from AT, visible to the eye.
    expect(list.querySelector('[aria-hidden="true"]')).toHaveTextContent("A");

    await userEvent.click(screen.getByRole("option", { name: "Haifa" }));
    expect(onSelect).toHaveBeenCalledWith("Haifa");
    expect(screen.getByRole("combobox")).toHaveValue("Haifa");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("typing filters to every match (not just eight), and leaves browse-all mode", async () => {
    render(<CityCombobox name="city" />);
    const input = screen.getByRole("combobox");

    await userEvent.click(screen.getByRole("button", { name: /browse all cities/i }));
    await userEvent.type(input, "kir");

    const list = screen.getByRole("listbox", { name: /matching cities/i });
    const names = screen.getAllByRole("option").map((o) => o.textContent);
    expect(names.length).toBeGreaterThan(8);
    expect(names.every((n) => n?.startsWith("Kiryat"))).toBe(true);
    expect(list).not.toHaveTextContent("All cities");
  });

  test("an empty, focused box lists all cities; Escape closes it", async () => {
    render(<CityCombobox name="city" />);
    const input = screen.getByRole("combobox");

    await userEvent.click(input);
    expect(screen.getAllByRole("option")).toHaveLength(CITIES.length);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
