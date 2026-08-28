import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// The map itself is MapLibre, which wants a WebGL canvas jsdom hasn't got.
// What matters here is that nothing map-shaped exists until the icon is
// pressed, and that the room is told apart from everything around it.
vi.mock("@/components/map/RoomMap", () => ({
  default: ({ places, nearby }: { places: { id: string }[]; nearby: { id: string }[] }) => (
    <div data-testid="map">
      {places.length} places, {nearby.length} nearby
    </div>
  ),
}));

import { RoomMapButton } from "@/components/map/RoomMapButton";

const POINT = { lat: 32.0578, lng: 34.7686 };
const PLACES = [
  { id: "node/1", name: "Cafe Xoho", kind: "cafe" as const, lat: 32.058, lng: 34.769 },
  { id: "node/2", name: "Port Said", kind: "bar" as const, lat: 32.0585, lng: 34.7695 },
];
const NEARBY = [
  { id: "a", lat: 32.059, lng: 34.77, rent: 3200, title: "Room", city: "Tel Aviv", neighborhood: "Florentin", photo: null },
  { id: "b", lat: 32.056, lng: 34.766, rent: 2900, title: "Room", city: "Tel Aviv", neighborhood: "Neve Tzedek", photo: null },
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

function mount(nearby = NEARBY) {
  return render(
    <RoomMapButton
      point={POINT}
      address="Florentin 54"
      city="Tel Aviv"
      note="Florentin 54, Tel Aviv."
      nearby={nearby}
    />
  );
}

function open() {
  return userEvent.click(screen.getByRole("button", { name: /open the map/i }));
}

test("the page shows the address and an icon — no map until it's pressed", async () => {
  mount();

  expect(screen.getByText(/Florentin 54, Tel Aviv\./)).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByTestId("map")).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();

  await open();

  expect(await screen.findByRole("dialog")).toHaveAttribute("aria-modal", "true");
  expect(await screen.findByTestId("map")).toHaveTextContent("2 places, 2 nearby");
});

test("what's nearby is asked for at the room's own point, once", async () => {
  mount();

  await open();
  await screen.findByTestId("map");
  expect(fetchMock).toHaveBeenCalledWith(`/api/places?lat=${POINT.lat}&lng=${POINT.lng}`);

  await userEvent.click(screen.getByRole("button", { name: /close map/i }));
  await open();
  await screen.findByTestId("map");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("the legend names the room first, then only the kinds actually shown", async () => {
  mount();
  await open();
  await screen.findByTestId("map");

  const legend = screen.getByRole("list");
  const entries = within(legend).getAllByRole("listitem").map((li) => li.textContent);
  expect(entries).toEqual(["This room", "2 other rooms nearby", "Cafés", "Bars"]);
});

test("with nothing else around, the legend doesn't claim there is", async () => {
  mount([]);
  await open();
  await screen.findByTestId("map");

  const legend = screen.getByRole("list");
  const entries = within(legend).getAllByRole("listitem").map((li) => li.textContent);
  expect(entries).toEqual(["This room", "Cafés", "Bars"]);
  expect(screen.getByTestId("map")).toHaveTextContent("0 nearby");
});

test("a busy lookup is retried, not accepted as an empty street", async () => {
  // `ok: false` means nobody answered. Taking that as "no cafés here" is how a
  // room in the middle of Tel Aviv ends up looking like it has nothing around it.
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ places: [], ok: false }) });
  mount();

  await open();

  expect(await screen.findByTestId("map", undefined, { timeout: 5000 })).toHaveTextContent("2 places");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("a lookup nobody answers still opens the map on the room", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ places: [], ok: false }) });
  mount();

  await open();

  expect(await screen.findByTestId("map", undefined, { timeout: 5000 })).toHaveTextContent("0 places");
  await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
});

test("a street with genuinely nothing on it is taken at its word", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ places: [], ok: true }) });
  mount();

  await open();

  expect(await screen.findByTestId("map")).toHaveTextContent("0 places");
  expect(fetchMock).toHaveBeenCalledTimes(1); // no pointless retry
});

test("closing is obvious — a labelled button, Escape, and focus comes back", async () => {
  mount();

  await open();
  await userEvent.click(await screen.findByRole("button", { name: /close map/i }));
  expect(screen.queryByRole("dialog")).toBeNull();

  await open();
  await screen.findByRole("dialog");
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  expect(document.activeElement).toBe(screen.getByRole("button", { name: /open the map/i }));
});
