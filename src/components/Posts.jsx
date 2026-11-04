import { useEffect, useState } from 'react';
import { Pencil, Trash2, RotateCcw, CalendarClock } from 'lucide-react';
import { api } from '../api';
import { RESULT } from '../platforms';

const TABS = [['all', 'All Posts'], ['published', 'Published'], ['scheduled', 'Scheduled'], ['draft', 'Drafts'], ['failed', 'Failed']];
export default function Posts({ onEdit, toast, refreshKey }) {
  const [tab, setTab] = useState('all'), [posts, setPosts] = useState([]), [open, setOpen] = useState(null);
  const load = () => api.get('/posts?status=' + tab).then(setPosts).catch((e) => toast(e.message, true));
  useEffect(() => { load(); }, [tab, refreshKey]);
  const latest = (p) => { const m = {}; p.results.forEach((r) => (m[r.account_id] = r)); return Object.values(m); };
  const retry = async (p) => { try { await api.post(`/posts/${p.id}/publish`, { onlyFailed: true }); toast('Retried failed accounts.'); load(); } catch (e) { toast(e.message, true); } };
  const del = async (p) => { if (!confirm('Delete this post?')) return; try { await api.del('/posts/' + p.id); load(); } catch (e) { toast(e.message, true); } };
  return (
    <div className="panel"><h2>Posts</h2>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {posts.length === 0 && <p className="muted">Nothing here yet.</p>}
      {posts.map((p) => (
        <div className="card post" key={p.id}>
          <div className="row"><b className="grow">{p.title || p.caption.slice(0, 60) || `Post #${p.id}`}</b>
            <span className={'badge ' + p.status}>{p.status}</span></div>
          <p className="muted">{p.caption.slice(0, 140)}</p>
          {p.scheduledAt && p.status === 'scheduled' && <div className="muted"><CalendarClock size={13} /> {new Date(p.scheduledAt).toLocaleString()}</div>}
          <div className="chips">{(p.status === 'draft' || p.status === 'scheduled' ? p.targets.length + ' account(s) selected' : latest(p).map((r) => <span key={r.id} className={'chip ' + r.status} title={r.message}>{r.account_name}: {RESULT[r.status]}</span>))}</div>
          <div className="row">
            {['draft', 'scheduled', 'failed'].includes(p.status) && <button className="btn sm" onClick={() => onEdit(p)}><Pencil size={13} /> Edit</button>}
            {p.status === 'failed' && <button className="btn sm primary" onClick={() => retry(p)}><RotateCcw size={13} /> Retry failed</button>}
            {['draft', 'scheduled'].includes(p.status) && <button className="btn sm danger" onClick={() => del(p)}><Trash2 size={13} /> Delete</button>}
            {p.results.length > 0 && <button className="btn sm ghost" onClick={() => setOpen(open === p.id ? null : p.id)}>History ({p.results.length})</button>}
          </div>
          {open === p.id && <div className="hist">{p.results.map((r) => <div key={r.id}><small>{new Date(r.created_at + 'Z').toLocaleString()}</small> {r.account_name}: <b>{RESULT[r.status]}</b> <small className="muted">{r.message}</small></div>)}</div>}
        </div>))}
    </div>
  );
}
