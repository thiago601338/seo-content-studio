import { Sparkles } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError(authError.message);
    setLoading(false);
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand"><span><Sparkles size={22} /></span><div><b>Revista Ideal</b><small>IA Studio</small></div></div>
        <h1>Entrar</h1>
        <p>Acesse a central de producao e publicacao SEO.</p>
        <label className="field"><span>E-mail</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label className="field"><span>Senha</span><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        {error && <div className="alert error">{error}</div>}
        <button className="btn primary full" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        <small className="login-note">Os usuarios sao gerenciados pelo Supabase Auth. Para uso privado, desative novos cadastros publicos.</small>
      </form>
    </div>
  );
}
