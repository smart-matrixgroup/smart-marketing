import { useState } from 'react';
import { PenSquare, Link2, Trash2, Unplug, Send, Paperclip, Copy, ExternalLink } from 'lucide-react';
import { api } from '../api';
import { PMAP, STATUS } from '../platforms';
import Logo from './Logo';

export function Welcome({ onCompose, locked, onLogin }) {
  return (
    <div className="welcome">
      <Logo size={84} />
      <h1>Welcome to SMART</h1>
      <p>Write one marketing post, pick the accounts, and publish to all of them from here.</p>
      <button className="btn primary big" onClick={locked ? onLogin : onCompose}><PenSquare size={20} /> {locked ? 'Sign in to start' : 'Create New Post'}</button>
      <ol className="steps"><li>Sign in with the SMART logo at the top left.</li><li>Open a platform in the middle column to see its accounts.</li><li>Click Create New Post, tick the accounts, then publish, schedule or save a draft.</li></ol>
    </div>
  );
}

export function AddAccount({ platform, config, onDone, onCancel, toast }) {
  const [name, setName] = useState(''), [ident, setIdent] = useState(''), [ext, setExt] = useState(''), [tok, setTok] = useState('');
  const fb = platform.id === 'facebook';
  const go = async () => {
    try {
      const a = await api.post('/accounts', { platform: platform.id, name, identifier: ident, externalId: ext, token: tok });
      if (a.status !== 'connected' && platform.id === 'gmail' && config.googleConfigured) { const r = await api.post(`/accounts/${a.id}/connect`); window.open(r.authUrl, '_blank'); toast('Finish signing in with Google in your browser, then return here.'); }
      else if (a.status !== 'connected') toast('Account added but not connected yet. Open it to connect.');
      onDone();
    } catch (e) { toast(e.message, true); }
  };
  return (
    <div className="overlay" onMouseDown={onCancel}><div className="modal" onMouseDown={(e) => e.stopPropagation()}>
      <h3>Add {platform.name} account</h3>
      <label>Display name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={`${platform.name} Account 01`} /></label>
      {platform.id !== 'gmail' && <label>{fb ? 'Page name' : 'Handle or number'}<input value={ident} onChange={(e) => setIdent(e.target.value)} /></label>}
      {fb && <><label>Page ID<input value={ext} onChange={(e) => setExt(e.target.value)} /></label>
        <label>Page access token <small>(stored encrypted)</small><input type="password" value={tok} onChange={(e) => setTok(e.target.value)} /></label></>}
      {!config.demo && !fb && platform.id !== 'gmail' && <p className="notice">{platform.note}</p>}
      {config.demo && <p className="notice">Demo mode is on. Accounts without a token are marked as demo and nothing is really posted.</p>}
      <div className="row end"><button className="btn" onClick={onCancel}>Cancel</button><button className="btn primary" disabled={!name} onClick={go}>Add account</button></div>
    </div></div>
  );
}

function EmailForm({ account, toast }) {
  const [to, setTo] = useState(''), [subject, setSubject] = useState(''), [body, setBody] = useState(''), [files, setFiles] = useState([]), [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { const r = await api.post('/email/send', { accountId: account.id, to, subject, body, files }); toast(r.message); if (r.status === 'sent') { setTo(''); setSubject(''); setBody(''); setFiles([]); } }
    catch (e) { toast(e.message, true); } finally { setBusy(false); }
  };
  return (
    <div className="card"><h3>Compose email</h3>
      <label>To<input value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com, other@example.com" /></label>
      <label>Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
      <label>Message<textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} /></label>
      <div className="row"><label className="btn"><Paperclip size={15} /> Attach files<input hidden type="file" multiple onChange={async (e) => setFiles([...files, ...(await api.upload(e.target.files))])} /></label>
        {files.map((f) => <span className="chip" key={f.path}>{f.name}</span>)}
        <span className="grow" /><button className="btn primary" disabled={busy || !to || !subject} onClick={send}><Send size={15} /> Send email</button></div>
    </div>
  );
}

export function AccountPanel({ account, config, onChanged, onCompose, toast }) {
  const p = PMAP[account.platform], [tok, setTok] = useState(''), [ext, setExt] = useState(account.externalId || ''), [share, setShare] = useState('');
  const act = async (fn) => { try { const r = await fn(); if (r?.authUrl) { window.open(r.authUrl, '_blank'); toast('Finish signing in with Google in your browser.'); } onChanged(); } catch (e) { toast(e.message, true); } };
  const connected = account.status === 'connected';
  return (
    <div className="panel">
      <div className="acc-head"><span className="pico big" style={{ background: p.color }}><p.Icon size={26} color="#fff" /></span>
        <div><h2>{account.name}</h2><div className="muted">{p.name}{account.identifier ? ' · ' + account.identifier : ''}</div></div>
        <span className={'badge ' + account.status}>{STATUS[account.status]}</span>{account.demo && <span className="badge demo">Demo</span>}</div>
      <div className="row">
        {connected && account.platform !== 'gmail' && <button className="btn primary" onClick={() => onCompose(account.id)}><PenSquare size={16} /> Create post for this account</button>}
        {p.profileUrl && <a className="btn" href={p.profileUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> View SMART {p.name} Page</a>}
        {!connected && <button className="btn primary" onClick={() => act(() => api.post(`/accounts/${account.id}/connect`, { token: tok, externalId: ext }))}><Link2 size={16} /> {account.status === 'expired' ? 'Reconnect' : 'Connect'}</button>}
        {connected && <button className="btn" onClick={() => act(() => api.post(`/accounts/${account.id}/disconnect`))}><Unplug size={16} /> Disconnect</button>}
        <button className="btn danger" onClick={() => confirm('Remove this account from SMART?') && act(() => api.del(`/accounts/${account.id}`))}><Trash2 size={16} /> Remove</button>
      </div>
      {!connected && account.platform !== 'gmail' && <div className="card"><p className="notice">{p.note}</p>
        <label>Access token <small>(optional, stored encrypted)</small><input type="password" value={tok} onChange={(e) => setTok(e.target.value)} /></label>
        {account.platform === 'facebook' && <label>Page ID<input value={ext} onChange={(e) => setExt(e.target.value)} /></label>}</div>}
      {!connected && account.platform === 'gmail' && <p className="notice">{config.googleConfigured ? 'Connect opens Google sign-in in your browser.' : 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env to enable Gmail sign-in. See README.'}</p>}
      {connected && account.platform === 'gmail' && <EmailForm account={account} toast={toast} />}
      {account.platform === 'whatsapp' && <p className="notice">Scan the QR code below with your phone (WhatsApp → Linked devices → Link a device). The login is remembered for this account.</p>}
      {connected && account.platform === 'whatsapp' && <details className="card"><summary><b>Copy text for a Status (manual)</b></summary>
        <p className="muted">WhatsApp does not allow apps to publish Status through its official API. Write your text, open WhatsApp, and post it as a Status yourself.</p>
        <textarea rows={5} value={share} onChange={(e) => setShare(e.target.value)} placeholder="Status text or caption" />
        <div className="row"><button className="btn" onClick={() => { navigator.clipboard.writeText(share); toast('Copied.'); }}><Copy size={15} /> Copy text</button>
          <button className="btn primary" onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent(share), '_blank')}><ExternalLink size={15} /> Open WhatsApp</button></div></details>}
      {connected && !['gmail', 'whatsapp'].includes(account.platform) && <p className="notice">{p.note}</p>}
    </div>
  );
}
