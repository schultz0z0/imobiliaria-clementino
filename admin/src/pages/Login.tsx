import { Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole } from 'lucide-react';
import React, { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';

const Brand = () => (
  <div className="auth-brand" aria-label="Clementino Imóveis">
    <span className="brand-mark" aria-hidden="true">C</span>
    <span><strong>Clementino</strong><small>Imóveis</small></span>
  </div>
);

const PasswordField = ({ id, name, label, value, onChange, autoComplete }: {
  id: string; name: string; label: string; value: string;
  onChange: (value: string) => void; autoComplete: string;
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      <div className="password-control">
        <input id={id} name={name} type={visible ? 'text' : 'password'} value={value} autoComplete={autoComplete} required onChange={(event) => onChange(event.currentTarget.value)} />
        <button className="icon-button" type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} onClick={() => setVisible((current) => !current)}>
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
};

const ChangePassword = () => {
  const { changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmation) { setError('As novas senhas precisam ser iguais.'); return; }
    setPending(true); setError('');
    try { await changePassword(currentPassword, newPassword); }
    catch { setError('Não foi possível alterar a senha. Confira os dados e tente novamente.'); }
    finally { setPending(false); }
  };
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="password-title">
        <Brand />
        <div className="auth-icon" aria-hidden="true"><KeyRound /></div>
        <h1 id="password-title">Crie uma nova senha</h1>
        <p className="auth-intro">Por segurança, atualize a senha provisória antes de continuar.</p>
        {error ? <p className="form-alert" role="alert">{error}</p> : null}
        <form onSubmit={submit}>
          <PasswordField id="current-password" name="currentPassword" label="Senha atual" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          <PasswordField id="new-password" name="newPassword" label="Nova senha" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          <PasswordField id="confirm-password" name="confirmPassword" label="Confirmar nova senha" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
          <p className="field-hint">Use ao menos 12 caracteres, com letras maiúsculas, minúsculas, número e símbolo.</p>
          <button className="button button-primary" type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="spin" aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}{pending ? 'Salvando…' : 'Salvar nova senha'}
          </button>
          <button className="button button-quiet" type="button" onClick={() => void logout()}>Sair com segurança</button>
        </form>
      </section>
    </main>
  );
};

export const Login = () => {
  const { status, mustChangePassword, sessionExpired, login, retry } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (status === 'loading') return <main className="auth-page"><p className="loading-state" role="status"><LoaderCircle className="spin" aria-hidden="true" /> Verificando acesso…</p></main>;
  if (status === 'error') return <main className="auth-page"><section className="auth-card"><Brand /><h1>Não foi possível carregar o painel</h1><p>Tente novamente em instantes.</p><button className="button button-primary" type="button" onClick={retry}>Tentar novamente</button></section></main>;
  if (status === 'authenticated' && mustChangePassword) return <ChangePassword />;
  if (status === 'authenticated') return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setPending(true); setError('');
    try { await login(username, password); }
    catch { setError('Não foi possível entrar. Confira suas credenciais e tente novamente.'); }
    finally { setPending(false); }
  };
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <Brand />
        <div className="auth-icon" aria-hidden="true"><LockKeyhole /></div>
        <h1 id="login-title">Acesso administrativo</h1>
        <p className="auth-intro">Gerencie os imóveis publicados no site Clementino.</p>
        {sessionExpired ? <p className="form-notice" role="status">Sua sessão expirou. Entre novamente para continuar.</p> : null}
        {error ? <p className="form-alert" role="alert">{error}</p> : null}
        <form onSubmit={submit}>
          <div className="field-group"><label htmlFor="username">Usuário</label><input id="username" name="username" autoComplete="username" value={username} required autoFocus onChange={(event) => setUsername(event.currentTarget.value)} /></div>
          <PasswordField id="password" name="password" label="Senha" value={password} onChange={setPassword} autoComplete="current-password" />
          <button className="button button-primary" type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="spin" aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}{pending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="security-note">Área restrita. Nunca compartilhe suas credenciais.</p>
      </section>
    </main>
  );
};
