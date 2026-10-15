'use client';
import { useState } from 'react';

export default function LogoutForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Chưa thể đăng xuất. Vui lòng thử lại.');
      window.location.replace('/login');
    } catch (error) { setError((error as Error).message); setBusy(false); }
  }
  return <><button className="button" onClick={logout} disabled={busy}>{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</button><a href="/">Quay lại Studio Hub</a>{error && <p role="alert">{error}</p>}</>;
}
