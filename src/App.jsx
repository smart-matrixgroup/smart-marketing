import { useCallback, useEffect, useState } from 'react';
import { Sun, Moon, Minus, Square, X, PenSquare, ListChecks } from 'lucide-react';
import { api, getToken, setToken } from './api';
import { COMPANY_LINKS } from './platforms';
import Logo from './components/Logo';
import Login from './components/Login';
import Accounts from './components/Accounts';
import Composer from './components/Composer';
import Posts from './components/Posts';
import { Welcome, AccountPanel, AddAccount } from './components/Workspace';

const WA_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// Platforms shown as a real, logged-in website inside the app (Gmail is excluded: Google blocks sign-in inside embedded browsers).
const WEB = { whatsapp: 'https://web.whatsapp.com', facebook: 'https://www.facebook.com', instagram: 'https://www.instagram.com', linkedin: 'https://www.linkedin.com', tiktok: 'https://www.tiktok.com', youtube: 'https://www.youtube.com' };

export default function App() {
  const [user, setUser] = useState(null), [accounts, setAccounts] = useState([]), [config, setConfig] = useState({ demo: false, googleConfigured: false });
  const [view, setView] = useState({ t: 'welcome' }), [loginOpen, setLoginOpen] = useState(false), [adding, setAdding] = useState(null), [toastMsg, setToast] = useState(null), [key, setKey] = useState(0);
  const [waOpen, setWaOpen] = useState([]);
  const [theme, setTheme] = useState(localStorage.getItem('smart_theme') || 'light');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('smart_theme', theme); }, [theme]);
  const toast = useCallback((m, bad) => { setToast({ m, bad }); setTimeout(() => setToast(null), 4500); }, []);
  const logout = useCallback((silent) => { setToken(null); setUser(null); setAccounts([]); setView({ t: 'welcome' }); setWaOpen([]); setLoginOpen(false); if (silent !== true) toast('Signed out.'); }, [toast]);
  const refresh = useCallback(() => api.get('/accounts').then(setAccounts).catch((e) => e.status === 401 && logout(true)), [logout]);
  useEffect(() => {
    api.get('/config').then(setConfig).catch(() => toast('Cannot reach the local SMART service.', true));
    if (getToken()) api.get('/me').then((r) => { setUser(r.user); refresh(); }).catch(() => setToken(null));
  }, []);
  useEffect(() => { if (user) { const i = setInterval(refresh, 15000); return () => clearInterval(i); } }, [user, refresh]);
  const [maxed, setMaxed] = useState(false);
  useEffect(() => { window.smart?.onMax(setMaxed); }, []);

  const needLogin = () => { setLoginOpen(true); };
  const select = async (a) => {
    setView({ t: 'account', id: a.id });
    if (WEB[a.platform]) setWaOpen((s) => (s.includes(a.id) ? s : [...s, a.id]));
    if (a.status !== 'connected' && config.demo) { try { await api.post(`/accounts/${a.id}/connect`); refresh(); } catch (e) { toast(e.message, true); } }
    else if (a.status !== 'connected' && a.platform === 'gmail' && config.googleConfigured) { try { const r = await api.post(`/accounts/${a.id}/connect`); window.open(r.authUrl, '_blank'); } catch (e) { toast(e.message, true); } }
  };
  const compose = (pre) => setView({ t: 'compose', pre: pre ? [pre] : [], k: Date.now() });
  const account = view.t === 'account' && accounts.find((a) => a.id === view.id);

  return (
    <div className="app">
      <header className="titlebar">
        <Logo size={20} /><span className="tt">SMART Social Manager</span><span className="grow" />
        <button className="tb" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Toggle theme">{theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}</button>
        <button className="tb" onClick={() => window.smart?.min()} aria-label="Minimize"><Minus size={15} /></button>
        <button className="tb" onClick={() => window.smart?.max()} aria-label="Maximize"><Square size={12} /></button>
        <button className="tb x" onClick={() => window.smart?.close()} aria-label="Close"><X size={16} /></button>
      </header>
      <div className="shell">
        <aside className="col brand">
          <button className="company" onClick={needLogin}><Logo size={56} /><b>SMART PVT LTD</b>
            <small>{user ? user.username : 'Click to sign in'}</small></button>
          {config.demo && <div className="demo-tag">DEMO MODE: nothing is really posted</div>}
          <div className="social-links">
            {COMPANY_LINKS.map((s) => (
              <span key={s.id} title={s.name} role="link" tabIndex={0} className="social-link" style={{ '--sc': s.color }}
                onClick={() => window.smart?.openUrl(s.url) || window.open(s.url, '_blank')}
                onKeyDown={(e) => e.key === 'Enter' && (window.smart?.openUrl(s.url) || window.open(s.url, '_blank'))}>
                <s.Icon size={16} />
              </span>
            ))}
          </div>
        </aside>
        <Accounts accounts={accounts} selected={account?.id} locked={!user} onSelect={select} onAdd={setAdding} />
        <main className="col work">
          {user && <div className="topbar"><button className={'btn' + (view.t === 'compose' ? ' primary' : '')} onClick={() => compose()}><PenSquare size={15} /> New Post</button>
            <button className={'btn' + (view.t === 'posts' ? ' primary' : '')} onClick={() => setView({ t: 'posts' })}><ListChecks size={15} /> Posts</button></div>}
          <div className="scroll">
            {view.t === 'welcome' || !user ? <Welcome locked={!user} onLogin={needLogin} onCompose={() => compose()} /> : null}
            {user && view.t === 'account' && account && <AccountPanel key={account.id + account.status} account={account} config={config} onChanged={refresh} onCompose={compose} toast={toast} />}
            {user && waOpen.map((id) => accounts.find((a) => a.id === id)).filter(Boolean).map((a) => (
              <div key={a.id} className="wa-wrap" style={{ display: view.t === 'account' && view.id === a.id ? 'block' : 'none' }}>
                <webview partition={'persist:' + (a.platform === 'whatsapp' ? 'wa' : a.platform) + '-' + a.id} src={WEB[a.platform]} useragent={WA_UA} allowpopups="true" style={{ width: '100%', height: '100%' }} />
              </div>))}
            {user && view.t === 'compose' && <Composer key={view.k} accounts={accounts} draft={view.draft} preselect={view.pre} toast={toast} onSaved={() => setKey((k) => k + 1)} />}
            {user && view.t === 'posts' && <Posts refreshKey={key} toast={toast} onEdit={(p) => setView({ t: 'compose', draft: p, k: Date.now() })} />}
          </div>
        </main>
      </div>
      {loginOpen && <Login user={user} onClose={() => setLoginOpen(false)} onLogout={logout} onLogin={(u) => { setUser(u); setLoginOpen(false); refresh(); }} />}
      {adding && <AddAccount platform={adding} config={config} toast={toast} onCancel={() => setAdding(null)} onDone={() => { setAdding(null); refresh(); }} />}
      {toastMsg && <div className={'toast' + (toastMsg.bad ? ' bad' : '')} role="status">{toastMsg.m}</div>}
    </div>
  );
}
