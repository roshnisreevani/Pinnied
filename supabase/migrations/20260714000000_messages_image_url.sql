-- Nullable image_url so shared Feed posts can render as a real thumbnail in
-- Banter instead of embedding the raw Supabase storage URL in the plain-text
-- content column. content stays NOT NULL (caption or a short placeholder);
-- image_url is purely additive and optional for every other message type.
alter table public.messages
  add column if not exists image_url text;
