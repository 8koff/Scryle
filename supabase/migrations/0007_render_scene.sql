-- Revibe: reopen a saved render in the studio. Run after 0006_invites.sql.
-- Keeps the photo reader's part map with each render, so an old photo can be edited again.
-- Renders saved before this have no map and can't be reopened (the page hides the button).
alter table public.renders add column if not exists scene jsonb;
