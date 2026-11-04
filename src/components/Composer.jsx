import { useState } from 'react';
import { Save, Send, CalendarClock, Eraser, ImagePlus, X, ExternalLink } from 'lucide-react';
import { api, mediaUrl } from '../api';
import { PLATFORMS, PMAP, RESULT, LIMITS } from '../platforms';

const toLocal = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
export const textOf = (title, caption, url) => [title, caption, url].filter(Boolean).join('\n\n');

export default function Composer({ accounts, draft, preselect, onSaved, toast }) {
  const [f, setF] = useState(() => draft
    ? { title: draft.title, caption: draft.caption, url: draft.url, media: draft.media, schedule: draft.scheduledAt ? toLocal(draft.scheduledAt) : '', targets: Object.fromEntries(draft.targets.map((t) => [t.accountId, t.caption || ''])) }
    : { title: '', caption: '', url: '', media: [], schedule: '', targets: Object.fromEntries((preselect || []).map((i) => [i, ''])) });
  const [id, setId] = useState(draft?.id), [res, setRes] = useState(null), [busy, setBusy] = useState(false), [edit, setEdit] = useState({});
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const sel = accounts.filter((a) => a.id in f.targets);
  const toggle = (a) => setF((s) => { const t = { ...s.targets }; a.id in t ? delete t[a.id] : (t[a.id] = ''); return { ...s, targets: t }; });
  const hasVideo = f.media.some((m) => m.mime.startsWith('video/'));
  const warn = (a) => { const [max, need] = LIMITS[a.platform] || []; const t = textOf(f.title, f.targets[a.id] || f.caption, f.url);
    if (max && t.length > max) return `${t.length}/${max} characters`; if (need === 'media' && !f.media.length) return 'Needs an image or video'; if (need === 'video' && !hasVideo) return 'Needs a video'; };
  const payload = (status) => ({ title: f.title, caption: f.caption, url: f.url, media: f.media, status, scheduledAt: f.schedule ? new Date(f.schedule).toISOString() : null,
    targets: Object.entries(f.targets).map(([k, v]) => ({ accountId: +k, caption: v || null })) });
  const valid = () => { if (!sel.length) { toast('Select at least one account.', true); return false; } if (!f.caption && !f.title && !f.media.length) { toast('Add a title, caption or media.', true); return false; } return true; };
  const save = async (status) => { const p = await (id ? api.put(`/posts/${id}`, payload(status)) : api.post('/posts', payload(status))); setId(p.id); return p; };
  const run = (fn) => async () => { setBusy(true); try { await fn(); } catch (e) { toast(e.message, true); } finally { setBusy(false); } };
  const draftIt = run(async () => { await save('draft'); toast('Draft saved.'); onSaved?.(); });
  const schedule = run(async () => { if (!valid()) return; if (!f.schedule || new Date(f.schedule) <= new Date()) return toast('Pick a future date and time.', true); await save('scheduled'); toast('Post scheduled. Keep SMART running at that time.'); onSaved?.(); });
  const publish = run(async () => { if (!valid()) return; const p = await save('draft'); const r = await api.post(`/posts/${p.id}/publish`); setRes(r.results.filter((x) => x.id >= Math.max(...r.results.map((y) => y.id)) - sel.length + 1)); onSaved?.(); });
  const clear = () => { setF({ title: '', caption: '', url: '', media: [], schedule: '', targets: {} }); setId(null); setRes(null); };
  const addMedia = async (files) => { try { set('media', [...f.media, ...(await api.upload(files))]); } catch (e) { toast(e.message, true); } };
  const first = f.media[0];

  return (
    <div className="composer">
      <div className="form">
        <h2>{id ? `Edit post #${id}` : 'New post'}</h2>
        <label>Post title<input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="SMART POS & ERP Solution" /></label>
        <label>Caption<textarea rows={5} value={f.caption} onChange={(e) => set('caption', e.target.value)} /></label>
        <label>Website URL<input value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" /></label>
        <div className="media">
          <label className="btn"><ImagePlus size={16} /> Add images or video<input hidden type="file" multiple accept="image/*,video/*" onChange={(e) => addMedia(e.target.files)} /></label>
          {f.media.map((m, i) => <span className="thumb" key={m.path}>{m.mime.startsWith('video/') ? <video src={mediaUrl(m.path)} /> : <img src={mediaUrl(m.path)} alt="" />}
            <button aria-label="Remove" onClick={() => set('media', f.media.filter((_, j) => j !== i))}><X size={12} /></button></span>)}
        </div>
        <h3>Publish to</h3>
        {PLATFORMS.map((p) => { const list = accounts.filter((a) => a.platform === p.id && p.id !== 'gmail'); return list.length > 0 && (
          <div className="pick" key={p.id}><div className="pick-h"><span className="pico sm" style={{ background: p.color }}><p.Icon size={13} color="#fff" /></span>{p.name}</div>
            {list.map((a) => { const on = a.id in f.targets, w = on && warn(a), ok = a.status === 'connected'; return (
              <div key={a.id} className="pick-i"><label className={'check' + (ok ? '' : ' off')}><input type="checkbox" disabled={!ok} checked={on} onChange={() => toggle(a)} /> {a.name}
                {!ok && <small> ({a.status})</small>}{w && <small className="warn"> · {w}</small>}</label>
                {on && <button className="link" onClick={() => setEdit({ ...edit, [a.id]: !edit[a.id] })}>{edit[a.id] ? 'Hide' : 'Edit caption'}</button>}
                {on && edit[a.id] && <textarea rows={3} placeholder="Platform-specific caption (leave empty to use the main caption)" value={f.targets[a.id]} onChange={(e) => setF((s) => ({ ...s, targets: { ...s.targets, [a.id]: e.target.value } }))} />}</div>); })}
          </div>); })}
        <label>Schedule for<input type="datetime-local" value={f.schedule} onChange={(e) => set('schedule', e.target.value)} /></label>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={publish}><Send size={16} /> Publish Now</button>
          <button className="btn" disabled={busy} onClick={schedule}><CalendarClock size={16} /> Schedule Post</button>
          <button className="btn" disabled={busy} onClick={draftIt}><Save size={16} /> Save as Draft</button>
          <button className="btn ghost" onClick={clear}><Eraser size={16} /> Clear Post</button>
        </div>
        {res && <div className="card results"><h3>Publishing results</h3>{res.map((r) => (
          <div className={'res ' + r.status} key={r.id}><b>{r.account_name}</b><span className="rs">{RESULT[r.status]}</span><small>{r.message}</small>
            {r.status === 'manual' && <button className="btn sm" onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent(textOf(f.title, f.targets[r.account_id] || f.caption, f.url)), '_blank')}><ExternalLink size={13} /> Open WhatsApp</button>}</div>))}</div>}
      </div>
      <aside className="preview"><h3>Preview</h3>
        <div className="pv">{first && (first.mime.startsWith('video/') ? <video src={mediaUrl(first.path)} controls /> : <img src={mediaUrl(first.path)} alt="" />)}
          {f.media.length > 1 && <small className="muted">+{f.media.length - 1} more</small>}
          <div className="pv-b">{f.title && <b>{f.title}</b>}<p>{f.caption || <span className="muted">Your caption appears here.</span>}</p>{f.url && <a>{f.url}</a>}</div></div>
        <p className="muted">{sel.length} account{sel.length === 1 ? '' : 's'} selected{sel.length ? ': ' + sel.map((a) => a.name).join(', ') : ''}</p>
      </aside>
    </div>
  );
}
