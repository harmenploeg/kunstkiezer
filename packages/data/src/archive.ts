import type { SupabaseClient } from '@supabase/supabase-js';

/** Only change publication state; preserve content, links and personal history. */
export async function setArchived(
  client: SupabaseClient,
  table: 'kk_museums' | 'kk_discoveries',
  row: { id: string; updated_at: string },
  archived: boolean,
) {
  const { data, error } = await client.from(table)
    .update({ publication_status: archived ? 'archived' : 'draft' })
    .eq('id', row.id).eq('updated_at', row.updated_at)
    .select('id').maybeSingle();
  if (error) throw Error('De wijziging is niet gelukt. Controleer je beheerdersrechten en probeer opnieuw.');
  if (!data) throw Error('Dit onderwerp is ondertussen gewijzigd of niet meer beschikbaar. Open het opnieuw.');
}
