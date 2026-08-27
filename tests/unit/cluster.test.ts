import { describe, expect, test } from "vitest";
import { clusterPoints, degreesPerPixel, zoomIntoCluster } from "@/lib/cluster";

const TLV = { lat: 32.0853, lng: 34.7818 };

/** n points a few metres apart — the "same building" case. */
function huddle(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `h${i}`,
    lat: TLV.lat + i * 0.00005,
    lng: TLV.lng + i * 0.00005,
  }));
}

describe("clusterPoints", () => {
  test("nothing in, nothing out", () => {
    expect(clusterPoints([], 10)).toEqual([]);
  });

  test("a single room stays a single pin, at its own position", () => {
    const [only] = clusterPoints([{ id: "a", ...TLV }], 12);
    expect(only.items).toHaveLength(1);
    expect(only.lat).toBe(TLV.lat);
    expect(only.lng).toBe(TLV.lng);
  });

  test("rooms in the same street merge at low zoom and separate at high zoom", () => {
    const points = huddle(8);
    const far = clusterPoints(points, 8);
    expect(far).toHaveLength(1);
    expect(far[0].items).toHaveLength(8);

    const close = clusterPoints(points, 19);
    expect(close.length).toBeGreaterThan(1);
  });

  test("every room is kept exactly once, whatever the zoom", () => {
    const points = [...huddle(5), { id: "far", lat: 31.7683, lng: 35.2137 }];
    for (const zoom of [6, 9, 12, 15, 18]) {
      const ids = clusterPoints(points, zoom).flatMap((c) => c.items.map((p) => p.id));
      expect(ids).toHaveLength(points.length);
      expect(new Set(ids).size).toBe(points.length);
    }
  });

  test("cities far apart never share a cluster at street zoom", () => {
    const clusters = clusterPoints(
      [
        { id: "tlv", ...TLV },
        { id: "jlm", lat: 31.7683, lng: 35.2137 },
        { id: "haifa", lat: 32.794, lng: 34.9896 },
      ],
      11
    );
    expect(clusters).toHaveLength(3);
  });

  test("a cluster sits at the average of its members", () => {
    const [c] = clusterPoints(
      [
        { id: "a", lat: 32.0, lng: 34.0 },
        { id: "b", lat: 32.02, lng: 34.02 },
      ],
      8
    );
    expect(c.items).toHaveLength(2);
    expect(c.lat).toBeCloseTo(32.01, 5);
    expect(c.lng).toBeCloseTo(34.01, 5);
  });

  test("no two clusters overlap on screen", () => {
    // The live map showed a 46-room circle sitting underneath a 48-room one,
    // unclickable. Centres must stay at least a cell apart at every zoom.
    const cities = [
      { lat: 32.0853, lng: 34.7818 }, // Tel Aviv
      { lat: 32.0687, lng: 34.8247 }, // Ramat Gan
      { lat: 32.073, lng: 34.8113 }, // Givatayim
      { lat: 32.0807, lng: 34.8338 }, // Bnei Brak
      { lat: 32.0114, lng: 34.7749 }, // Holon
      { lat: 32.0155, lng: 34.7505 }, // Bat Yam
      { lat: 31.7683, lng: 35.2137 }, // Jerusalem
      { lat: 32.794, lng: 34.9896 }, // Haifa
    ];
    const points = cities.flatMap((c, ci) =>
      Array.from({ length: 12 }, (_, i) => ({
        id: `${ci}-${i}`,
        lat: c.lat + (i % 4) * 0.004,
        lng: c.lng + Math.floor(i / 4) * 0.004,
      }))
    );
    for (const zoom of [6, 7, 8, 9, 10, 12, 14]) {
      const clusters = clusterPoints(points, zoom);
      const cellLng = degreesPerPixel(zoom) * 80;
      const cellLat = cellLng * Math.cos((32 * Math.PI) / 180);
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const d = Math.hypot(
            (clusters[i].lat - clusters[j].lat) / cellLat,
            (clusters[i].lng - clusters[j].lng) / cellLng
          );
          expect(d, `zoom ${zoom}: clusters ${i} and ${j} overlap`).toBeGreaterThanOrEqual(1);
        }
      }
      // and nothing is lost in the merge
      expect(clusters.flatMap((c) => c.items)).toHaveLength(points.length);
    }
  });

  test("bigger clusters are drawn first so small pins don't hide them", () => {
    const points = [...huddle(6), { id: "lonely", lat: 31.7683, lng: 35.2137 }];
    const clusters = clusterPoints(points, 9);
    expect(clusters[0].items.length).toBeGreaterThanOrEqual(clusters[clusters.length - 1].items.length);
  });

  test("keys are stable between renders at the same zoom", () => {
    const points = huddle(4);
    expect(clusterPoints(points, 12).map((c) => c.key)).toEqual(clusterPoints(points, 12).map((c) => c.key));
  });
});

describe("degreesPerPixel", () => {
  test("halves with every zoom level", () => {
    expect(degreesPerPixel(0)).toBeCloseTo(360 / 256);
    expect(degreesPerPixel(1)).toBeCloseTo(degreesPerPixel(0) / 2);
    expect(degreesPerPixel(10)).toBeLessThan(degreesPerPixel(9));
  });
});

describe("zoomIntoCluster", () => {
  test("steps in, and never past the maximum", () => {
    expect(zoomIntoCluster(8)).toBe(10);
    expect(zoomIntoCluster(17)).toBe(18);
    expect(zoomIntoCluster(18)).toBe(18);
  });
});
