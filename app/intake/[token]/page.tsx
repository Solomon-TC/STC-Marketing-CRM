import { randomUUID } from 'crypto';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatNoteTimestamp } from '@/lib/types';

// The one page in this app a client fills out with no login at all, via
// their own unique link (/intake/<intake_token>). Everything here runs
// server-side through the service-role client -- RLS denies the anon role
// on every table on purpose, so there's no way (and no need) for this page
// to touch Supabase with the public anon key.
//
// force-dynamic (same as the Dashboard in app/page.tsx) because Next.js
// caches fetch() calls made during server rendering by default -- without
// this, the page can keep showing pre-submission data (or a stale "not
// submitted yet" state) right after a client submits and gets redirected
// back here.
export const dynamic = 'force-dynamic';

export default async function IntakePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const admin = createAdminClient();

  const { data: client } = await admin.from('website_clients').select('*').eq('intake_token', token).single();

  if (!client) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-sm text-ink/60">
          This link isn&apos;t valid. Please check the link you were sent, or reach out to whoever sent it to you.
        </p>
      </div>
    );
  }

  const { count: photoCount } = await admin
    .from('website_client_photos')
    .select('id', { count: 'exact', head: true })
    .eq('website_client_id', client.id);

  async function submitIntake(formData: FormData) {
    'use server';
    const admin = createAdminClient();

    const { data: current } = await admin
      .from('website_clients')
      .select('id, stage')
      .eq('intake_token', token)
      .single();
    if (!current) return;

    const field = (name: string) => (formData.get(name) as string) || null;

    const patch: Record<string, unknown> = {
      intake_business_description: field('business_description'),
      intake_services: field('services'),
      intake_service_area_details: field('service_area_details'),
      intake_selling_points: field('selling_points'),
      intake_inspiration_urls: field('inspiration_urls'),
      intake_other_notes: field('other_notes'),
      intake_submitted_at: new Date().toISOString(),
    };
    // Only auto-advance out of Intake -- if the client is already further
    // along (e.g. correcting something after Building started), a
    // resubmission shouldn't drag their card backward on the board.
    if (current.stage === 'intake') {
      patch.stage = 'info_received';
    }

    await admin.from('website_clients').update(patch).eq('id', current.id);

    const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
    for (const file of files) {
      const path = `${current.id}/${Date.now()}-${randomUUID()}-${file.name}`;
      const { error: uploadError } = await admin.storage
        .from('website-client-uploads')
        .upload(path, file, { contentType: file.type || undefined });
      if (!uploadError) {
        await admin.from('website_client_photos').insert({ website_client_id: current.id, storage_path: path });
      }
    }

    redirect(`/intake/${token}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-10">
      <div>
        <h1 className="font-serif text-2xl">Tell us about {client.business_name}</h1>
        <p className="text-sm text-ink/60">
          A few questions to help us build your new website. Nothing here is set in stone -- share what you have,
          and we'll follow up if we need anything else.
        </p>
      </div>

      {client.intake_submitted_at && (
        <div className="card border-accent/30 bg-accentSoft/40">
          <p className="text-sm text-ink/80">
            Thanks -- we received this on {formatNoteTimestamp(client.intake_submitted_at)}. You can update anything
            below and submit again if something changes.
          </p>
        </div>
      )}

      <form action={submitIntake} className="card space-y-4">
        <Field label="Tell us about your business">
          <textarea
            name="business_description"
            className="input"
            rows={4}
            defaultValue={client.intake_business_description ?? ''}
            placeholder="What you do, your story, anything you'd want a visitor to know."
          />
        </Field>
        <Field label="Services you offer">
          <textarea
            name="services"
            className="input"
            rows={3}
            defaultValue={client.intake_services ?? ''}
          />
        </Field>
        <Field label="Service area">
          <textarea
            name="service_area_details"
            className="input"
            rows={2}
            defaultValue={client.intake_service_area_details ?? ''}
            placeholder="Cities/regions you serve."
          />
        </Field>
        <Field label="What makes you stand out?">
          <textarea
            name="selling_points"
            className="input"
            rows={3}
            defaultValue={client.intake_selling_points ?? ''}
            placeholder="Anything you want front and center -- awards, reviews, years in business, guarantees..."
          />
        </Field>
        <Field label="Any websites you like (competitors or just ones you like the look of)">
          <textarea
            name="inspiration_urls"
            className="input"
            rows={2}
            defaultValue={client.intake_inspiration_urls ?? ''}
            placeholder="One link per line is fine."
          />
        </Field>
        <Field label="Anything else you'd like on the site">
          <textarea
            name="other_notes"
            className="input"
            rows={3}
            defaultValue={client.intake_other_notes ?? ''}
          />
        </Field>
        <Field label="Photos">
          <input name="photos" type="file" multiple accept="image/*" className="input" />
          {!!photoCount && (
            <p className="mt-1 text-xs text-ink/50">
              {photoCount} photo{photoCount === 1 ? '' : 's'} already received -- new ones you add here are on top
              of those, not instead of them.
            </p>
          )}
        </Field>
        <button type="submit" className="btn-primary">
          Submit
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-ink/70">{label}</label>
      {children}
    </div>
  );
}
