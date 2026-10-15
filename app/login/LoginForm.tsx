'use client';
import { useState } from 'react';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Chưa thể đăng nhập.');
      window.location.replace('/');
    } catch (error) { setError((error as Error).message); setBusy(false); }
  }
  return <form onSubmit={submit} className="login-form"><label className="form-field"><span>Email</span><input type="email" autoComplete="username" required value={email} maxLength={200} onChange={event => setEmail(event.target.value)} /></label><label className="form-field"><span>Mật khẩu</span><input type="password" autoComplete="current-password" required value={password} maxLength={1024} onChange={event => setPassword(event.target.value)} /></label>{error && <div className="notice" role="alert">{error}</div>}<button className="button" disabled={busy} type="submit">{busy ? 'Đang đăng nhập…' : 'Đăng nhập Studio Hub'}</button></form>;
}
