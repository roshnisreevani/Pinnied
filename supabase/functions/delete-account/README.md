# Deploying the delete-account function

This is the one piece of "Delete Account" that can't run inside the app — deleting a Supabase
auth user requires the service role key, which must never be bundled into client code. This
Edge Function does it instead, server-side.

## One-time setup

From your project root (`the-rec/`), run:

```bash
npx supabase login
npx supabase link --project-ref dtrjnvbldzyqjtbuceou
npx supabase functions deploy delete-account
```

- `login` opens a browser to authenticate the CLI with your Supabase account.
- `link` connects this local `supabase/` folder to your actual project.
- `deploy` uploads `index.ts` as a live Edge Function.

No manual secrets needed — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
are automatically available inside every Edge Function's environment.

## What it does

1. Reads the caller's access token from the `Authorization` header (the app sends this
   automatically via `supabase.functions.invoke`).
2. Verifies that token to find out which user is asking.
3. Uses an admin client (service role) to delete that specific `auth.users` row.

The app calls this (see `lib/account.ts`) only after it has already deleted the user's profile
row and their files from the `avatars` and `pick-three` storage buckets.

## Testing it

Once deployed, the Settings screen's "Delete Account" button will call it automatically. You can
also invoke it manually to confirm it's live:

```bash
npx supabase functions list
```

should show `delete-account` with a status of `ACTIVE`.
