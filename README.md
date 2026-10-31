# Education Planer Complete Education System

## Supabase-connected version

This version no longer stores courses, lessons, or daily checks in browser LocalStorage. It uses Supabase Auth + PostgreSQL.

### Connected Supabase project
- Project: `SmartyPlan`
- Project ref: `nstrhxhxoinaakcswzzc`
- Region: `eu-west-1`

### Authentication
- Email + password sign in
- Account creation
- Supabase session persistence
- Sign out
- User-specific database access through Row Level Security (RLS)

### Database
The old public education tables were reset and recreated as:
- `public.courses`
- `public.lessons`
- `public.daily_checks`

All three tables have RLS enabled and policies that restrict rows to `auth.uid() = user_id`.

### Features
- Responsive dashboard
- Hamburger sidebar on mobile
- Dark mode
- Course registration with total lessons
- Automatic Day 1...Day N lesson structure
- Today's Lessons
- Lesson Notes
- Daily Progress
- Learning Streak
- Time Tracking
- Learning Goals
- Daily Check
- Course progress linked to completed lessons
- Practice and Quiz checkboxes
- Professional toast messages instead of JavaScript alerts

### Important Supabase Auth note
Hosted Supabase projects normally require email confirmation for new email/password accounts. After creating an account, check the email confirmation message if the project requires it, then sign in.

### Run
Open `index.html` in a modern browser or serve the folder from a simple local web server.

The frontend contains only the Supabase publishable/anon key. Never put a Supabase `service_role` or secret key in browser code.

## UI redesign (My Especeal Design)
- Navy sidebar with logo, green active pill; sticky blurred top bar
- Dashboard hero, color-coded stat cards with icon tiles, rounded cards
- Phosphor icons everywhere (nav, cards, buttons, toasts, checklists)
- Pro dark mode (navy) with a sun/moon toggle; login screen in the Smarty dark style
- Fully responsive: desktop sidebar, drawer on tablet/mobile
- Structure, IDs, Supabase logic and RLS unchanged. Visible brand corrected to "SmartyPlan".

## Private login + Settings (single-owner system)
- Sign-up removed from the UI: email + password sign-in only.
- Eye icon on every password field (show / hide).
- Client-side attempt limiter: 5 failed logins -> 30s lock, doubling up to 15 min.
- New **Settings** page: account info, change password (requires current password, strength meter,
  signs out other devices afterwards), change email (password + Supabase confirmation link),
  sign out other devices / everywhere, JSON backup export, erase-all-data (type DELETE).

### REQUIRED in the Supabase dashboard (UI alone cannot stop sign-ups)
1. Authentication -> Sign In / Providers -> Email: turn **OFF "Allow new users to sign up"**
   (create your one user under Authentication -> Users -> Add user, "Auto confirm").
2. Authentication -> Sign In / Providers -> Email: set **Minimum password length 8+** and enable
   **"Secure password change"** (and leaked-password protection if your plan has it).
3. Keep the RLS policies (`auth.uid() = user_id`) as they are.
