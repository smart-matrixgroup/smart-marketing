import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { PLATFORMS, STATUS } from '../platforms';

export default function Accounts({ accounts, selected, onSelect, onAdd, locked }) {
  const [open, setOpen] = useState({ whatsapp: true });
  if (locked) return <div className="col mid"><h2>Social accounts</h2><p className="muted pad">Click the SMART logo on the left and sign in to see your accounts.</p></div>;
  return (
    <div className="col mid">
      <h2>Social accounts</h2>
      <div className="plist">
        {PLATFORMS.map((p) => {
          const list = accounts.filter((a) => a.platform === p.id), ok = list.filter((a) => a.status === 'connected').length, o = open[p.id];
          return (
            <div className="plat" key={p.id}>
              <button className="plat-head" aria-expanded={!!o} onClick={() => setOpen({ ...open, [p.id]: !o })}>
                {p.profileUrl
                  ? <span className="pico plat-icon-link" style={{ background: p.color }} title={`Open SMART ${p.name} Page`} role="link" tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); window.open(p.profileUrl, '_blank'); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); window.open(p.profileUrl, '_blank'); } }}>
                      <p.Icon size={17} color="#fff" /></span>
                  : <span className="pico" style={{ background: p.color }}><p.Icon size={17} color="#fff" /></span>}
                <span className="pn">{p.name}</span><span className="count" title="Connected / total">{ok}/{list.length}</span>
                <ChevronRight size={16} className={'chev' + (o ? ' rot' : '')} />
              </button>
              {o && <div className="plat-body">
                {list.map((a) => (
                  <button key={a.id} className={'acc' + (selected === a.id ? ' sel' : '')} onClick={() => onSelect(a)}>
                    <i className={'dot ' + a.status} /><span className="an">{a.name}</span><small>{STATUS[a.status]}</small>
                  </button>))}
                <button className="acc add" onClick={() => onAdd(p)}><Plus size={14} /> Add {p.name} account</button>
              </div>}
            </div>);
        })}
      </div>
    </div>
  );
}
