/**
 * Profile page layout (2026-08-25, user request).
 *
 *  true  → `/profile` is read-only and looks exactly like other members see it;
 *          ALL editing — basics and the About-me details — lives on the pencil
 *          page (`/profile/edit`) as one form with one Save button.
 *  false → the previous layout: the About-me tab on `/profile` is an inline
 *          editor with its own Save, and the pencil page edits only the basics.
 *
 * To undo the change, flip this to `false` and redeploy — nothing else needs
 * to move; both layouts share the same components and database rows.
 */
export const PROFILE_EDIT_ON_PENCIL_PAGE = true;
