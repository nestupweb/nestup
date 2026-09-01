import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Profile } from "@/lib/types";

afterEach(cleanup);

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const CONVERSATION = "33333333-3333-4333-8333-333333333333";
const sendIntroAction = vi.fn(async () => ({ ok: true as const, conversationId: CONVERSATION }));
const saveIntroTemplateAction = vi.fn(async () => ({ ok: true }));
vi.mock("@/app/actions/swipe", () => ({
  sendIntroAction: (...args: unknown[]) => sendIntroAction(...(args as [])),
  saveIntroTemplateAction: (...args: unknown[]) => saveIntroTemplateAction(...(args as [])),
}));

import { MessageOwner } from "@/components/listings/MessageOwner";

const LISTING = "11111111-1111-4111-8111-111111111111";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: "o1", full_name: "Dana Levi", age: 29, occupation: "Chef", bio: "",
    avatar_url: null, smoker: false, has_pet: false, cleanliness: 3,
    sleep_schedule: "flexible", guests_freq: "sometimes",
    interests: [], ok_with_smoker: true, ok_with_pets: true,
    noise_level: "moderate", diet: "none", pref_cleanliness: 1, pref_sleep: "any", pref_guests: "any",
    pref_noise: "any", pref_diet: "any", shabbat: "", pref_shabbat: "any", chores: [], gender: null,
    pref_same_gender: false, budget_min: 0, budget_max: 3000, preferred_cities: [], earliest_move_in: null,
    pref_lease_term: "any", pref_safe_room: "any", pref_amenities: [], notify_new_matches: false,
    created_at: "", updated_at: "", ...overrides,
  };
}

const household = [profile(), profile({ user_id: "r1", full_name: "Noa Bar", age: 24 })];

// A two-person household, so the CTA reads "Message the roommates" here.
function open() {
  return render(<MessageOwner listingId={LISTING} household={household} template="" />);
}

beforeEach(() => {
  push.mockClear();
  sendIntroAction.mockClear();
});

test("the button opens the sheet instead of navigating to the chat", async () => {
  open();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /^message the roommates$/i }));

  const dialog = screen.getByRole("dialog", { name: /message the roommates/i });
  expect(dialog).toBeInTheDocument();
  // Not a like — nothing here claims one.
  expect(screen.queryByText(/you liked/i)).not.toBeInTheDocument();
  // Nothing is created by opening it.
  expect(sendIntroAction).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
});

test("the sheet opens with the seeker's default hello, editable", async () => {
  render(<MessageOwner listingId={LISTING} household={household} template="Hey {name}, is it still free?" />);
  await userEvent.click(screen.getByRole("button", { name: /^message the roommates$/i }));

  const box = screen.getByRole("textbox", { name: /message to the roommates/i }) as HTMLTextAreaElement;
  expect(box.value).toBe("Hey Dana, is it still free?");
  await userEvent.type(box, " Thanks!");
  expect(box.value).toBe("Hey Dana, is it still free? Thanks!");
});

test("a seeker with no saved template gets the built-in hello", async () => {
  open();
  await userEvent.click(screen.getByRole("button", { name: /^message the roommates$/i }));
  const box = screen.getByRole("textbox", { name: /message to the roommates/i }) as HTMLTextAreaElement;
  expect(box.value).toBe("Hi, I liked the room — can we schedule a viewing?");
});

test("Cancel closes the sheet without starting a conversation", async () => {
  open();
  await userEvent.click(screen.getByRole("button", { name: /^message the roommates$/i }));
  await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(sendIntroAction).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
  // And it can be opened again.
  await userEvent.click(screen.getByRole("button", { name: /^message the roommates$/i }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

test("Send posts the message and says so, without leaving the listing", async () => {
  open();
  await userEvent.click(screen.getByRole("button", { name: /^message the roommates$/i }));
  const box = screen.getByRole("textbox", { name: /message to the roommates/i });
  await userEvent.clear(box);
  await userEvent.type(box, "Hi from the listing page");
  await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

  expect(sendIntroAction).toHaveBeenCalledWith(LISTING, "Hi from the listing page");
  await waitFor(() => expect(screen.getByRole("dialog", { name: /message sent/i })).toBeInTheDocument());
  // The seeker was reading this room; sending doesn't take it off their screen.
  expect(push).not.toHaveBeenCalled();
  // The conversation is offered, not forced.
  expect(screen.getByRole("link", { name: /open the conversation/i })).toHaveAttribute("href", `/chat/${CONVERSATION}`);

  // The backdrop is labelled "Close" too — this is the button in the sheet.
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^close$/i }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^message the roommates$/i })).toBeInTheDocument();
});

test("a failed send keeps the sheet, the text, and the conversation unstarted", async () => {
  sendIntroAction.mockResolvedValueOnce({ ok: false, error: "This room can't receive messages right now." } as never);
  open();
  await userEvent.click(screen.getByRole("button", { name: /^message the roommates$/i }));
  await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/can't receive messages/i);
  expect(screen.getByRole("textbox", { name: /message to the roommates/i })).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});

test("the CTA counts the household it messages: singular for an owner living alone, plural once anyone else is there", async () => {
  const { unmount } = render(<MessageOwner listingId={LISTING} household={[profile()]} template="" />);
  expect(screen.getByRole("button", { name: /^message the roommate$/i })).toBeInTheDocument();
  // The sheet it opens agrees with the button that opened it.
  await userEvent.click(screen.getByRole("button", { name: /^message the roommate$/i }));
  expect(screen.getByRole("dialog", { name: /^message the roommate$/i })).toBeInTheDocument();
  unmount();

  render(
    <MessageOwner
      listingId={LISTING}
      household={[profile(), profile({ user_id: "r1" }), profile({ user_id: "r2" })]}
      template=""
    />
  );
  expect(screen.getByRole("button", { name: /^message the roommates$/i })).toBeInTheDocument();
});

// The bug that prompted this: "Ground-floor room with a yard, Nazareth" has
// roommates_count = 1 but an owner AND a resident under "Who lives here", and
// the button read "Message the roommate". The household is what counts.
test("an owner plus one resident is plural, whatever the listing's roommates_count says", () => {
  render(<MessageOwner listingId={LISTING} household={household} template="" />);
  expect(household).toHaveLength(2);
  expect(screen.getByRole("button", { name: /^message the roommates$/i })).toBeInTheDocument();
});
