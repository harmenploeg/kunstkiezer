import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../account/AuthContext.tsx';
type Member = { user_id: string; email: string; is_admin: boolean };
export function UserAdmin() {
  const { client, user, refresh } = useAuth();
  const [rows, setRows] = useState<Member[]>([]), [email, setEmail] = useState(''),
    [message, setMessage] = useState(''), [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false), [remove, setRemove] = useState<Member | null>(null);
  async function load() {
    if (!client) return;
    const result = await client.rpc('kk_list_members');
    if (result.error) throw Error('Gebruikers konden niet worden geladen.');
    setRows(result.data); setReady(true);
  }
  useEffect(() => { void load().catch(e => setMessage(e.message)); }, [client]);
  async function invoke(body: Record<string, unknown>) {
    if (!client) throw Error('Geen verbinding met de accountdatabase.');
    const result = await client.functions.invoke('manage-users', { body });
    if (result.error) {
      let detail: { error?: string } = {};
      try { detail = await result.error.context?.json() ?? {}; } catch { /* Network error has no JSON response. */ }
      throw Error(detail.error || 'Gebruikersbeheer is niet bereikbaar. Probeer opnieuw.');
    }
    if (result.data?.error) throw Error(result.data.error);
    return result.data;
  }
  async function run(action: () => Promise<string>) {
    setBusy(true); setMessage('');
    try {
      const success = await action();
      try { await load(); await refresh(); setMessage(success); }
      catch { setMessage(success + ' Het vernieuwen van de lijst is niet gelukt. Laad de pagina opnieuw.'); }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Gebruikersbeheer is niet gelukt.');
      try { await load(); } catch { /* Preserve the actionable error. */ }
    } finally { setBusy(false); }
  }
  function invite(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      const result = await invoke({ action: 'invite', email: email.trim() });
      if (!result?.invited) throw Error('De uitnodiging kon niet worden bevestigd. Laad de lijst opnieuw.');
      setEmail('');
      return 'Gebruiker toegevoegd. De uitnodiging is verstuurd; via de e-maillink kiest de gebruiker een eigen wachtwoord.';
    });
  }
  return <section className="account-panel" aria-labelledby="user-admin-title">
    <h2 id="user-admin-title">Gebruikers en beheerders</h2>
    <p>Voeg iemand toe met een uitnodiging per e-mail. Een gebruiker beheert het eigen profiel en bezoeken. Een beheerder kan daarnaast de redactie, instellingen en gebruikers beheren. De laatste beheerder blijft altijd behouden.</p>
    <form className="login-form" onSubmit={invite}>
      <label>E-mailadres nieuwe gebruiker<input type="email" autoComplete="off" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
      <button className="primary-button" disabled={busy || !ready}>Gebruiker toevoegen</button>
    </form>
    <button disabled={busy} onClick={() => void run(async () => 'Gebruikerslijst vernieuwd.')}>Gebruikers opnieuw laden</button>
    {!ready && !message && <p>Gebruikers laden…</p>}
    {ready && !rows.length && <p>Geen gebruikers gevonden.</p>}
    <ul className="member-list">{rows.map(member => <li key={member.user_id}>
      <span>{member.email}{member.user_id === user?.id ? ' (jij)' : ''} · {member.is_admin ? 'Beheerder' : 'Gebruiker'}</span>
      <div className="account-modes">
        <button disabled={busy || (member.is_admin && rows.filter(row => row.is_admin).length === 1)} onClick={() => {
          if (!confirm(`${member.email}: ${member.is_admin ? 'beheerdersrechten intrekken' : 'beheerdersrechten geven'}?`)) return;
          void run(async () => {
            const result = await client!.rpc('kk_set_admin', { member_id: member.user_id, allowed: !member.is_admin });
            if (result.error) throw Error(result.error.message);
            return 'Rechten bijgewerkt.';
          });
        }}>{member.is_admin ? 'Beheer intrekken' : 'Maak beheerder'}</button>
        {member.user_id !== user?.id && <button disabled={busy} onClick={() => setRemove(member)}>Gebruiker verwijderen</button>}
      </div>
    </li>)}</ul>
    {remove && <section className="notice" role="region" aria-label="Gebruiker verwijderen bevestigen">
      <h3>{remove.email} verwijderen?</h3>
      <p>Het account, de voorkeuren, bezoeken en waarderingen worden definitief verwijderd. Dit kun je niet ongedaan maken.</p>
      <button disabled={busy} onClick={() => void run(async () => {
        const result = await invoke({ action: 'delete', user_id: remove.user_id });
        if (!result?.deleted) throw Error('Verwijderen kon niet worden bevestigd. Laad de lijst opnieuw.');
        setRemove(null); return 'Gebruiker en bijbehorende accountgegevens verwijderd.';
      })}>Definitief verwijderen</button>
      <button disabled={busy} onClick={() => setRemove(null)}>Annuleren</button>
    </section>}
    {message && <p role="status">{message}</p>}
  </section>;
}
