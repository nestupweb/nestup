import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { useStickyForm } from "@/lib/hooks";

afterEach(cleanup);

type S = { error?: string };

/**
 * The bug this hook exists for: React 19 clears an uncontrolled form the moment
 * a form action returns, so a rejected submission threw away everything the
 * member had already typed.
 */
function Form({ action }: { action: (prev: S, data: FormData) => Promise<S> }) {
  const [state, form, pending] = useStickyForm<S>(action, {});
  return (
    <form {...form}>
      <label>
        Full name
        <input name="full_name" defaultValue="" />
      </label>
      <label>
        City
        <input name="city" defaultValue="" />
      </label>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" name="intent" value="save">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

test("a rejected form keeps every value the member typed", async () => {
  render(<Form action={async () => ({ error: "City: pick at least one." })} />);
  await userEvent.type(screen.getByLabelText("Full name"), "Dana Levi");
  await userEvent.click(screen.getByRole("button"));

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("City: pick at least one."), { timeout: 8000 });
  expect(screen.getByLabelText("Full name")).toHaveValue("Dana Levi");
});

test("the action still receives the whole form, including the button pressed", async () => {
  const action = vi.fn(async (_p: S, data: FormData): Promise<S> => ({
    error: `${data.get("full_name")}|${data.get("city")}|${data.get("intent")}`,
  }));
  render(<Form action={action} />);
  await userEvent.type(screen.getByLabelText("Full name"), "Dana");
  await userEvent.type(screen.getByLabelText("City"), "Haifa");
  await userEvent.click(screen.getByRole("button"));

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Dana|Haifa|save"), { timeout: 8000 });
});

test("the button reports the submission is in flight, then comes back", async () => {
  let release = () => {};
  const action = async (): Promise<S> => {
    await new Promise<void>((r) => (release = r));
    return { error: "Nope." };
  };
  render(<Form action={action} />);
  await userEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("Saving…"), { timeout: 8000 });
  release();
  await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("Save"), { timeout: 8000 });
});
