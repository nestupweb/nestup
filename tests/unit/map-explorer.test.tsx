import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// The map itself is MapLibre, which wants a WebGL canvas jsdom hasn't got.
// What matters here is the shell around it: the button, the panel, the ways out.
vi.mock("@/components/map/ListingsMap", () => ({
  default: ({ pins }: { pins: { id: string }[] }) => <div data-testid="map">{pins.length} pins</div>,
}));

import { MapExplorer } from "@/components/map/MapExplorer";

const PINS = [
  { id: "a", lat: 32.07, lng: 34.78, rent: 3200, title: "One", city: "Tel Aviv", neighborhood: "Florentin", photo: null },
  { id: "b", lat: 31.77, lng: 35.21, rent: 2600, title: "Two", city: "Jerusalem", neighborhood: "", photo: null },
];

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ pins: PINS, total: PINS.length }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("the button opens the map, and the map shows every room on the site", async () => {
  render(<MapExplorer />);
  const button = screen.getByRole("button", { name: /open the map/i });
  expect(screen.queryByRole("dialog")).toBeNull();

  await userEvent.click(button);

  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(await screen.findByTestId("map")).toHaveTextContent("2 pins");
  expect(screen.getByText(/2 rooms on the map/i)).toBeInTheDocument();
  expect(screen.getByText(/pinned at its address/i)).toBeInTheDocument();
  // Unfiltered: the dialog asks for every pin, with no query string.
  expect(fetchMock).toHaveBeenCalledWith("/api/listings/pins");
});

test("closing is obvious — a labelled button, Escape, or the backdrop", async () => {
  render(<MapExplorer />);
  const open = () => userEvent.click(screen.getByRole("button", { name: /open the map/i }));

  await open();
  await userEvent.click(await screen.findByRole("button", { name: /close map/i }));
  expect(screen.queryByRole("dialog")).toBeNull();

  await open();
  await screen.findByRole("dialog");
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  // Focus comes back to the trigger, so the keyboard doesn't lose its place.
  expect(document.activeElement).toBe(screen.getByRole("button", { name: /open the map/i }));
});

test("the pins are fetched once and kept for the rest of the visit", async () => {
  render(<MapExplorer />);
  const open = () => userEvent.click(screen.getByRole("button", { name: /open the map/i }));

  await open();
  await screen.findByTestId("map");
  await userEvent.click(screen.getByRole("button", { name: /close map/i }));
  await open();
  await screen.findByTestId("map");

  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("a failed fetch offers a retry rather than an empty map", async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
  render(<MapExplorer />);
  await userEvent.click(screen.getByRole("button", { name: /open the map/i }));

  const retry = await screen.findByRole("button", { name: /try again/i });
  expect(screen.queryByTestId("map")).toBeNull();

  await userEvent.click(retry);
  expect(await screen.findByTestId("map")).toHaveTextContent("2 pins");
});
