import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, ShieldCheck, Sprout } from 'lucide-react';
import { Form } from './forms';
import { api } from './api';
import { useState } from 'react';
export function Auth({ onLogin }: { onLogin: (user: any) => void }) {
  const { pathname } = useLocation(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const [message, setMessage] = useState('');
  const register = pathname === '/register',
    forgot = pathname === '/forgot-password',
    reset = pathname === '/reset-password',
    verify = pathname === '/verify-email';
  const title = register
    ? 'Empieza una nueva etapa.'
    : forgot
      ? 'Recupera tu acceso.'
      : reset
        ? 'Una nueva contraseña.'
        : verify
          ? 'Verifica tu correo.'
          : 'Qué bueno tenerte aquí.';
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Link className="brand" to="/">
          <span className="brand-symbol">
            <Sprout />
          </span>
          financy<span className="brand-dot">.</span>
        </Link>
        <div>
          <span className="eyebrow">MENOS RUIDO. MÁS CLARIDAD.</span>
          <h1>
            Tu dinero.
            <br />
            Tus planes.
            <br />
            <em>Tu tranquilidad.</em>
          </h1>
          <p>Un espacio para entender tus finanzas y darle lugar a lo que de verdad importa.</p>
          <div className="auth-art">
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
            <span className="art-card">
              <Sprout size={32} />
              <small>PEQUEÑOS PASOS</small>
              <strong>Grandes posibilidades.</strong>
              <ArrowUpRight />
            </span>
          </div>
        </div>
        <small className="auth-bottom">
          <ShieldCheck size={16} /> Tu información, en tu control.
        </small>
      </div>
      <div className="auth-form">
        <div>
          <span className="eyebrow">BIENVENIDO A FINANCY</span>
          <h2>{title}</h2>
          <p className="muted">
            {register
              ? 'Crea tu cuenta y empieza a organizar tus finanzas.'
              : forgot
                ? 'Te enviaremos un enlace a tu correo.'
                : reset
                  ? 'Usa al menos 10 caracteres.'
                  : 'Tus cuentas claras empiezan aquí.'}
          </p>
          {message ? (
            <div className="notice">
              {message}
              <Link to="/login">Volver al inicio de sesión</Link>
            </div>
          ) : (
            <Form
              key={pathname}
              label={
                register
                  ? 'Crear mi cuenta'
                  : forgot
                    ? 'Enviar enlace'
                    : reset
                      ? 'Actualizar contraseña'
                      : verify
                        ? 'Verificar correo'
                        : 'Entrar a mi espacio'
              }
              onDone={() => {}}
              onSubmit={async (v) => {
                if (forgot) {
                  const r = await api('/auth/forgot-password', 'POST', v);
                  setMessage(r.message);
                } else if (reset || verify) {
                  await api('/auth' + pathname, 'POST', { ...v, token: params.get('token') });
                  setMessage(
                    reset
                      ? 'Contraseña actualizada. Ya puedes iniciar sesión.'
                      : 'Correo verificado.',
                  );
                } else {
                  const u = await api('/auth/' + (register ? 'register' : 'login'), 'POST', v);
                  onLogin(u);
                  navigate('/dashboard');
                }
              }}
            >
              {register && (
                <label>
                  Tu nombre
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={255}
                    placeholder="¿Cómo te llamas?"
                  />
                </label>
              )}
              {!reset && !verify && (
                <label>
                  Correo electrónico
                  <input
                    name="email"
                    autoComplete="email"
                    type="email"
                    placeholder="tu@correo.com"
                    required
                  />
                </label>
              )}
              {!forgot && !verify && (
                <label>
                  Contraseña
                  <input
                    name="password"
                    type="password"
                    autoComplete={register || reset ? 'new-password' : 'current-password'}
                    required
                    minLength={register || reset ? 10 : 1}
                    maxLength={72}
                    placeholder="Tu contraseña"
                  />
                </label>
              )}
              {!register && !forgot && !reset && !verify && (
                <Link className="forgot-link" to="/forgot-password">
                  Olvidé mi contraseña
                </Link>
              )}
            </Form>
          )}
          {!forgot && !reset && !verify && (
            <p className="auth-switch">
              {register ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'}{' '}
              <Link to={register ? '/login' : '/register'}>
                {register ? 'Inicia sesión' : 'Empieza aquí'}
              </Link>
            </p>
          )}
          <div className="auth-footnote">Tus finanzas merecen un poco de calma.</div>
        </div>
      </div>
    </div>
  );
}
