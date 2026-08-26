import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { COUNTRIES, DEFAULT_COUNTRY, composePhone, splitPhone, suggestCountries } from "@/lib/phone";
import { PhoneField } from "@/components/profile/PhoneField";

afterEach(cleanup);

describe("phone helpers", () => {
  test("country data: alphabetical, Israel is +972 and the default, every entry has a flag-able code", () => {
    expect(DEFAULT_COUNTRY).toMatchObject({ code: "IL", dial: "+972" });
    expect(COUNTRIES.length).toBeGreaterThan(200);
    const names = COUNTRIES.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
    for (const c of COUNTRIES) expect(c.code).toMatch(/^[A-Z]{2}$/);
  });

  test("suggestCountries: name prefix, any-word prefix, dial digits, ISO code", () => {
    expect(suggestCountries("isr")[0].code).toBe("IL");
    expect(suggestCountries("king")[0].name).toBe("United Kingdom");
    expect(suggestCountries("+97").map((c) => c.dial)).toEqual(expect.arrayContaining(["+972", "+970", "+971", "+973", "+974", "+975", "+976", "+977"]));
    expect(suggestCountries("972")[0].code).toBe("IL");
    expect(suggestCountries("gb")[0].code).toBe("GB");
    expect(suggestCountries("").length).toBe(COUNTRIES.length);
  });

  test("splitPhone: prefixed numbers find their country (longest code, shared codes → the usual one); bare numbers are Israeli", () => {
    expect(splitPhone("+44 7700 900123")).toMatchObject({ country: { code: "GB" }, local: "7700 900123" });
    expect(splitPhone("+1 (212) 555-0100")).toMatchObject({ country: { code: "US" }, local: "(212) 555-0100" });
    expect(splitPhone("+972 50-123-4567")).toMatchObject({ country: { code: "IL" }, local: "50-123-4567" });
    expect(splitPhone("050-123-4567")).toMatchObject({ country: { code: "IL" }, local: "050-123-4567" });
    expect(splitPhone("")).toMatchObject({ country: { code: "IL" }, local: "" });
  });

  test("composePhone: dial + local, trunk 0 dropped (kept for Italy), empty stays empty", () => {
    expect(composePhone("+972", "050-123-4567")).toBe("+972 50-123-4567");
    expect(composePhone("+972", "50 123 4567")).toBe("+972 50 123 4567");
    expect(composePhone("+39", "06 1234 5678")).toBe("+39 06 1234 5678");
    expect(composePhone("+972", "   ")).toBe("");
  });
});

describe("PhoneField", () => {
  test("starts on Israel, submits the composed number under `name`", async () => {
    const { container } = render(<PhoneField defaultValue="" />);
    const country = screen.getByRole("combobox", { name: /country code/i });
    expect(country).toHaveValue("+972");
    expect(container.querySelector('img[src="/flags/IL.svg"]')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/phone number/i), "050-123-4567");
    expect(container.querySelector('input[name="phone"]')).toHaveValue("+972 50-123-4567");
  });

  test("a stored international number pre-selects its country and local part", () => {
    const { container } = render(<PhoneField defaultValue="+44 7700 900123" />);
    expect(screen.getByRole("combobox", { name: /country code/i })).toHaveValue("+44");
    expect(screen.getByLabelText(/phone number/i)).toHaveValue("7700 900123");
    expect(container.querySelector('img[src="/flags/GB.svg"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="phone"]')).toHaveValue("+44 7700 900123");
  });

  test("search a country like a city: type, arrow, Enter — flag and code follow", async () => {
    const { container } = render(<PhoneField defaultValue="" />);
    const country = screen.getByRole("combobox", { name: /country code/i });
    await userEvent.click(country);
    expect(screen.getByRole("listbox", { name: /countries/i })).toBeInTheDocument();
    await userEvent.type(country, "united");
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options[0]).toContain("United Arab Emirates");
    expect(options.some((o) => o?.includes("United Kingdom"))).toBe(true);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(country).toHaveValue("+44");
    expect(container.querySelector('img[src="/flags/GB.svg"]')).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).toBeNull();
    await userEvent.type(screen.getByLabelText(/phone number/i), "7700 900123");
    expect(container.querySelector('input[name="phone"]')).toHaveValue("+44 7700 900123");
  });

  test("Escape closes the list and shows the code again", async () => {
    render(<PhoneField defaultValue="" />);
    const country = screen.getByRole("combobox", { name: /country code/i });
    await userEvent.click(country);
    await userEvent.type(country, "fra");
    expect(screen.getAllByRole("option")[0].textContent).toContain("France");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(country).toHaveValue("+972");
  });
});
