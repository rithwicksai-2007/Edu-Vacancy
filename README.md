# React + TypeScript + Vite

## Backend and Supabase

The FastAPI backend lives in `Backend/`. It uses Supabase Auth access tokens
(JWTs) for authentication and Supabase Postgres/Storage for persistent data.
The API verifies token signatures against the project's JWKS, checks issuer and
audience, and only grants administrator access when the server-managed
`app_metadata.platform_role` claim is `admin`.

1. Create a Supabase project and copy `Backend/.env.example` to
   `Backend/.env`. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the
   project's API settings. Use a service-role or secret key here, not the
   `sb_publishable_` key used by the frontend. Keep this server key private;
   never put it in a `VITE_` variable or commit it. If the project's JWT
   signing algorithm is legacy `HS256`, also set `SUPABASE_JWT_SECRET`.
   Supabase's asymmetric signing keys are fetched and cached from its JWKS
   endpoint.
2. Open the Supabase SQL Editor and run
   [`Backend/supabase/schema.sql`](./Backend/supabase/schema.sql). This
   creates the profile, preference, vacancy, saved-item, application,
   connection, complaint, notification, and audit tables, row-level security
   policies, private document buckets, and an Auth trigger that creates
   profile/detail rows from registration metadata. If the database was set up
   earlier, rerun this idempotent script before using username registration or
   notifications.
3. Copy the project-root `.env.example` to `.env` and set
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the browser Auth client.
   Set `VITE_API_BASE_URL` if the API is not running at
   `http://127.0.0.1:8000`. The anon key is intended for browser use; the
   service-role key is not.
4. From the project root, create a virtual environment, install the backend
   dependencies, and start the API:

```powershell
py -m venv Backend\.venv
.\Backend\.venv\Scripts\Activate.ps1
python -m pip install -r Backend\requirements.txt
python -m uvicorn Backend.main:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell blocks virtual-environment activation, run the server directly:

```powershell
Backend\.venv\Scripts\python.exe -m uvicorn Backend.main:app --reload --host 127.0.0.1 --port 8000
```

The API is available at `http://127.0.0.1:8000`; interactive documentation is
at `/docs`, and `/health` is a health check. CORS allows the Vite development
origins by default. Set `FRONTEND_ORIGINS` to a comma-separated list of
explicit frontend origins to override them.
Use `/ready` to confirm the backend has the required Supabase URL and
server-side key configured before signing in.

Authenticated API requests must send
`Authorization: Bearer {access_token}`. Main endpoint groups:

- `/api/v1/auth/me` and `/api/v1/profiles/*` for identity and profile management
- `/api/v1/directory/*`, `/api/v1/vacancies`, and `/api/v1/applications/*` for
 recruitment
- `/api/v1/connections/*` and `/api/v1/complaints/*` for platform interactions
- `/api/v1/saved-vacancies/*` and `/api/v1/saved-teachers/*` for saved items
- `/api/v1/notifications/*` for the signed-in user's in-app inbox
- `/api/v1/admin/*` for protected moderation, reporting, and audit history

The job-seeker and institution dashboards load profiles, vacancies, candidates,
applications, saved items, and moderation states through the authenticated API.
Registration creates a Supabase Auth account through the backend and the
database trigger creates its profile/detail rows. Resume and institution
certificate files use the configured private Supabase Storage buckets.

### Username accounts

Users register and sign in with a username and password. Supabase Auth still
requires an email-shaped login identifier, so the backend derives a private
address such as `sample.user@users.eduvacancy.invalid` from the username; the
app does not collect or display a real email address. New accounts are created
as confirmed Auth users, so email confirmation and SMTP are not part of this
sign-in flow. Usernames must be 3–30 characters and use letters, numbers,
dots, underscores, or hyphens.

After running the updated schema, migrate existing profiled accounts while
preserving their UUIDs and passwords:

```powershell
Backend\.venv\Scripts\python.exe -m Backend.migrate_to_usernames
```

The migration uses `Backend/.env`, maps each profiled account's existing
username to its private synthetic Auth address, and confirms the account.
Accounts without an application profile are reported and skipped; assign their
intended application role and create the profile before migrating them.

Administrators can send in-app messages to all users or one selected account
from the admin dashboard. Job-seeker and institution dashboards include an
inbox where users can read messages and mark them as read. No external email
delivery is configured.

To grant an administrator, set `platform_role: "admin"` in the user's Supabase
Auth **app metadata** (not user metadata), and ensure the matching `profiles`
row has `role = 'admin'`. For an account already registered in this app, update
its row in the SQL Editor using its trusted user UUID:

```sql
update public.profiles
set role = 'admin', status = 'Verified', status_reason = null
where id = '00000000-0000-0000-0000-000000000000';
```

Access tokens issued before the metadata change must be refreshed.
The API never trusts a role supplied in editable user metadata.

### Sign-in troubleshooting

- If the password is accepted but the page reports that it cannot reach the
  API, start the FastAPI server using the command above. Confirm
  `http://127.0.0.1:8000/health` returns `{"status":"ok"}`, and check
  `VITE_API_BASE_URL` if the API uses another address.
- If sign-in reports that the database schema is missing or out of date, open
  the Supabase SQL Editor for the project configured in both `.env` files and
  run [`Backend/supabase/schema.sql`](./Backend/supabase/schema.sql). This
  creates the `profiles` table and the other database objects required by
  login and the dashboards.
- The backend also needs `Backend/.env` with `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY`; without these it cannot validate the access
  token or look up the administrator profile. `SUPABASE_URL` must be the same
  project URL as `VITE_SUPABASE_URL` in the frontend `.env`. Use a Supabase
  server-side `service_role` JWT or `sb_secret_` key, never the frontend
  publishable key.
- If `/api/v1/auth/me` returns 401 with a different-project message, correct
  `SUPABASE_URL`, restart the backend, then sign out and sign in again to get a
  token from the matching Supabase project. For legacy HS256 tokens, also set
  that project's `SUPABASE_JWT_SECRET`.
- If the API reports that the account is not an administrator, confirm
  `platform_role: "admin"` is set in Supabase Auth **app metadata** and the
  matching `profiles` row has `role = 'admin'`. Sign out and back in after
  changing app metadata so the new access token includes the updated claim.
- Sign in with the username and password for that Supabase Auth user. There is
  no built-in/default administrator password.

There is no self-service password recovery because the app does not collect
email addresses. Users who lose access must contact a platform administrator
for account recovery.

Run the backend contract tests from the project root with:

```powershell
Backend\.venv\Scripts\python.exe -m unittest discover -s Backend\tests
```

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
