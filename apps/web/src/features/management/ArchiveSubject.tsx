import { useState } from 'react';
import { useAuth } from '../account/AuthContext.tsx';
import { setArchived } from '../../../../../packages/data/src/archive.ts';

export function ArchiveSubject({ table, row, onDone }: {
  table: 'kk_museums' | 'kk_discoveries';
  row: { id: string; name: string; updated_at: string; publication_status: string };
  onDone: () => void;
}) {
  const { client } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const archived = row.publication_status === 'archived';
  async function change() {
    if (!client || busy) return;
    setBusy(true); setError('');
    try { await setArchived(client, table, row, !archived); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Wijzigen mislukt.'); }
    finally { setBusy(false); }
  }
  return <section className="notice" aria-label="Onderwerp verwijderen of herstellen">
    {error && <p role="alert">{error}</p>}
    {archived ? <><p>Dit onderwerp staat in het archief en is niet zichtbaar voor bezoekers.</p>
      <button type="button" disabled={busy} onClick={() => void change()}>Herstellen als concept</button></>
    : confirm ? <><p>‘{row.name}’ verwijderen uit het aanbod? Het onderwerp verhuist naar het archief. Beoordelingen en bezoekgeschiedenis blijven bewaard. Niet-opgeslagen bewerkingen vervallen.</p>
      <button type="button" disabled={busy} onClick={() => void change()}>{busy ? 'Verwijderen…' : 'Ja, verwijderen'}</button>{' '}
      <button type="button" disabled={busy} onClick={() => setConfirm(false)}>Annuleren</button></>
    : <button type="button" onClick={() => setConfirm(true)}>Onderwerp verwijderen</button>}
  </section>;
}
