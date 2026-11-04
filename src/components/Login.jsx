import { useState } from 'react';
import { Eye, EyeOff, LogOut, X } from 'lucide-react';
import { api, setToken } from '../api';
import Logo from './Logo';

export default function Login({ user, onLogin, onLogout, onClose }) {
  const [u, setU] = useState(''), [p, setP] = useState(''), [show, setShow] = useState(false), [rem, setRem] = useState(true), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr('');
    try { const r = await api.post('/login', { username: u, password: p, remember: rem }); setToken(r.token, rem); onLogin(r.user); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal login" onMouseDown={(e) => e.stopPropagation()}>
        <button className="icon-btn close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <Logo size={52} />
        {user ? (<>
          <h3>SMART Company</h3><p className="muted">Signed in as <b>{user.username}</b></p>
          <button className="btn danger wide" onClick={onLogout}><LogOut size={16} /> Log out</button>
        </>) : (<>
          <h3>Sign in to SMART</h3>
          <label>Username or email<input autoFocus value={u} onChange={(e) => setU(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} /></label>
          <label>Password
            <span className="pw"><input type={show ? 'text' : 'password'} value={p} onChange={(e) => setP(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
              <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label="Show or hide password">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>
          </label>
          <label className="check"><input type="checkbox" checked={rem} onChange={(e) => setRem(e.target.checked)} /> Remember me</label>
          {err && <div className="err">{err}</div>}
          <button className="btn primary wide" disabled={busy || !u || !p} onClick={submit}>{busy ? 'Signing in…' : 'Log in'}</button>
        </>)}
      </div>
    </div>
  );
}
