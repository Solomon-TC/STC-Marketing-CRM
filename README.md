# STC Marketing CRM

A CRM built with Next.js and Supabase. Contacts, a custom deal pipeline, tasks,
a dashboard, and CSV import.

## What's included

- **Contacts**: name, company, email, phone, industry, location, and free-text
  notes. Filterable by industry and location, searchable by name/company/email.
- **Pipeline**: your actual stages, in order: Cold lead, Warm lead, Called/contacted,
  Requested followup, Follow up, Won, Lost, Invoice sent, Invoice received,
  Ad made, Ad confirmed.
- **Tasks**: linked to contacts, with due dates and a done/not-done toggle.
- **Dashboard**: contact count, open pipeline value, won/lost counts, deals by
  stage, and upcoming tasks.
- **CSV import**: upload a spreadsheet export, map its columns to contact
  fields, import in bulk.
- **Auth**: Supabase email/password login. Both you and your partner get full,
  identical access. No per-user permission tiers.

## One-time setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account/project.
2. In the project dashboard, go to **SQL Editor > New query**, paste the
   contents of `supabase/schema.sql`, and run it. This creates all the tables,
   the pipeline stage list, and the security rules.
3. Go to **Project Settings > API** and copy the **Project URL** and the
   **anon public key**. You'll need both in step 3 below.

### 2. Create your two logins

In the Supabase dashboard, go to **Authentication > Users > Add user** and
create one login for yourself and one for your partner (email + password).
You can also enable "Auto Confirm User" so you don't need to click an email
confirmation link.

### 3. Configure the app

1. Copy `.env.local.example` to `.env.local`.
2. Fill in the two values from step 1:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### 4. Install and run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with either
account you created in step 2.

## Deploying so you both can access it from anywhere

The easiest path is [Vercel](https://vercel.com) (built by the same team as
Next.js, free tier is enough for this):

1. Push this project to a GitHub repo (private is fine).
2. In Vercel, click **Add New Project** and import that repo.
3. When it asks for environment variables, add the same two from your
   `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Deploy. You'll get a URL like `stc-crm.vercel.app` that both of you can log
   into from any device.

If you'd rather have Claude Code do the GitHub push and Vercel deploy for you,
just hand it this folder and ask it to do steps 1-4.

## Importing your existing spreadsheet

1. Export your spreadsheet as a CSV (in Excel or Google Sheets: File > Download > CSV).
2. Log in, go to **Import**, upload the file.
3. Map each of your spreadsheet's columns to the right contact field (name,
   company, email, phone, industry, location, notes). Columns you don't map
   are just skipped.
4. Click Import.

## Extending this later

Some things you may want to add down the road, all straightforward with
Claude Code once the base app is running:

- Email or calendar sync
- Deal-stage automation (e.g. auto-create an invoice task when a deal hits
  "Invoice sent")
- Reporting exports (CSV/PDF)
- Mobile-friendly polish beyond the current responsive layout

## Notes on repeatability

The CSV import screen is reusable any time you get a new batch of leads (trade
shows, ad platforms, etc.), so you don't need to add contacts one by one.
If bulk imports become a regular weekly/monthly task, it's worth turning the
column-mapping choices you make most often into a saved default, or asking
Claude to template it as a Skill.
