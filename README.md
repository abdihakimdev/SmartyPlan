# SmaryPlan Complete Education System

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
