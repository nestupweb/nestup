export const CITIES = [
  "Tel Aviv", "Jerusalem", "Haifa", "Ramat Gan", "Givatayim", "Herzliya",
  "Beer Sheva", "Rishon LeZion", "Petah Tikva", "Netanya", "Rehovot", "Raanana",
] as const;

export const INTERESTS = [
  "Music", "Concerts", "Cooking", "Fitness", "Yoga", "Running", "Hiking",
  "Travel", "Gaming", "Movies & TV", "Reading", "Art", "Photography", "Tech",
  "Football", "Basketball", "Board games", "Nightlife", "Vegan food", "Volunteering",
] as const;

export const MIN_INTERESTS = 3;
export const MAX_INTERESTS = 10;
export const MAX_LISTING_PHOTOS = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export const FEATURES = [
  { key: "balcony", label: "Balcony" },
  { key: "air_conditioning", label: "Air conditioning" },
  { key: "parking", label: "Parking" },
  { key: "elevator", label: "Elevator" },
  { key: "furnished", label: "Furnished" },
] as const;
