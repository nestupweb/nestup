import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// The map itself is MapLibre, which wants a WebGL canvas jsdom hasn't got.
// What matters here is that nothing map-shaped exists until the icon is
// pressed, and that the room is told apart from everything around it.
vi.mock("@/components/map/RoomMap", () => ({
  default: ({ places }: { places: { id: string }[] }) => <div data-testid="map">{places.length} places</div>,
}));

import { RoomMapButton } from "@/components/map/RoomMapButton";

const POINT = { lat: 32.0578, lng: 34.7686 };
const PLACES = [
  { id: "node/1", name: "Cafe Xoho", kind: "cafe" as const, lat: 32.058, lng: 34.769 },
  { id: "node/2", name: "Port Said", kind: "bar" as const, lat: 32.0585, lng: 34.7695 },
];

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ places: PLACES }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function open() {
  return userEvent.click(screen.getByRole("button", { name: /open the map/i }));
}

test("the page shows the address and an icon — no map until it's pressed", async () => {
  render(<RoomMapButton point={POINT} address="Florentin 54" city="Tel Aviv" note="Florentin 54, Tel Aviv." />);

  expect(screen.getByText(/Florentin 54, Tel Aviv\./)).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByTestId("map")).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();

  await open();

  expect(await screen.findByRole("dialog")).toHaveAttribute("aria-modal", "true");
  expect(await screen.findByTestId("map")).toHaveTextContent("2 places");
});

test("what's nearby is asked for at the room's own point, once", async () => {
  render(<RoomMapButton point={POINT} address="Florentin 54" city="Tel Aviv" note="Florentin 54, Tel Aviv." />);

  await open();
  await screen.findByTestId("map");
  expect(fetchMock).toHaveBeenCalledWith(`/api/places?lat=${POINT.lat}&lng=${POINT.lng}`);

  await userEvent.click(screen.getByRole("button", { name: /close map/i }));
  await open();
  await screen.findByTestId("map");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("the legend names the room first, then only the kinds actually shown", async () => {
  render(<RoomMapButton point={POINT} address="Florentin 54" city="Tel Aviv" note="Florentin 54, Tel Aviv." />);
  await open();
  await screen.findByTestId("map");

  const legend = screen.getByRole("list");
  const entries = within(legend).getAllByRole("listitem").map((li) => li.textContent);
  expect(entries).toEqual(["This room", "Cafés", "Bars"]);
});

test("a places lookup that fails still opens the map on the room", async () => {
  fetchMock.mockRejectedValueOnce(new Error("overpass is busy"));
  render(<RoomMapButton point={POINT} address="Florentin 54" city="Tel Aviv" note="Florentin 54, Tel Aviv." />);

  await open();

  expect(await screen.findByTestId("map")).toHaveTextContent("0 places");
  await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
});

test("closing is obvious — a labelled button, Escape, and focus comes back", async () => {
  render(<RoomMapButton point={POINT} address="Florentin 54" city="Tel Aviv" note="Florentin 54, Tel Aviv." />);

  await open();
  await userEvent.click(await screen.findByRole("button", { name: /close map/i }));
  expect(screen.queryByRole("dialog")).toBeNull();

  await open();
  await screen.findByRole("dialog");
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  expect(document.activeElement).toBe(screen.getByRole("button", { name: /open the map/i }));
});
