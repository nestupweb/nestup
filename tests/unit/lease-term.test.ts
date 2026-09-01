import { expect, test } from "vitest";
import { LEASE_TERMS, leaseTermLabel } from "@/lib/constants";
import { listingSchema } from "@/lib/validation/listing";

const base = {
  city: "Tel Aviv", street: "Florentin", house_number: "12", rent: 2800, available_from: "2026-10-01", roommates_count: 2, household_size: 2,
};

test("lease term is a rough duration in words — never an end date", () => {
  expect(LEASE_TERMS.map((t) => t.label)).toEqual([
    "Flexible", "A month", "2 months", "3 months", "Half a year", "A year", "2 years", "Long-term",
  ]);
  expect(leaseTermLabel("half_year")).toBe("Half a year");
  expect(leaseTermLabel("year")).toBe("A year");
  for (const t of LEASE_TERMS) expect(t.label).not.toMatch(/\d{4}/); // no dates
});

test("listingSchema accepts a lease term, defaults to flexible, and rejects junk", () => {
  expect(listingSchema.parse({ ...base, lease_term: "half_year" }).lease_term).toBe("half_year");
  expect(listingSchema.parse(base).lease_term).toBe("flexible"); // older forms without the field
  expect(listingSchema.safeParse({ ...base, lease_term: "2027-03-01" }).success).toBe(false);
});
