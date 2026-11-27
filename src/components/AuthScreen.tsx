import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  Mail,
  Radio,
  RefreshCw,
  ShieldCheck,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { OrcaLogo } from './OrcaLogo';

type AuthStage = 'welcome' | 'form';
type FormMode = 'login' | 'register';

export const AuthScreen: React.FC = () => {
  const {
    firebaseUser,
    emailVerified,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    resendVerificationEmail,
    refreshAuthUser,
    logout,
  } = useAuth();

  const [stage, setStage] = useState<AuthStage>('welcome');
  const [mode, setMode] = useState<FormMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);

  // If user signed up via Email/Password and hasn't verified email yet
  if (firebaseUser && !emailVerified) {
    return (
      <div className="min-h-screen bg-[#06070B] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-[#0E1117] border border-white/10 p-7 space-y-6">
          <div className="flex items-center justify-between">
            <OrcaLogo size="sm" showTagline />
            <button
              type="button"
              onClick={() => void logout()}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Sair
            </button>
          </div>
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
              <Mail className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight">
              Confirme seu e-mail
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Enviamos um link de verificação para{' '}
              <span className="text-slate-200 font-medium">{firebaseUser.email}</span>.
              Confirme para liberar seu acesso em tempo real ao ORCA.
            </p>
          </div>

          {infoMsg && (
            <p className="text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-3.5 py-2.5">
              {infoMsg}
            </p>
          )}
          {errorMsg && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3.5 py-2.5">
              {errorMsg}
            </p>
          )}

          <div className="space-y-3">
            <button
              type="button"
              disabled={loadingProvider === 'verify'}
              onClick={async () => {
                setLoadingProvider('verify');
                setErrorMsg(null);
                try {
                  const ok = await refreshAuthUser();
                  if (!ok) {
                    setErrorMsg('E-mail ainda não confirmado. Verifique sua caixa de entrada ou spam.');
                  }
                } catch {
                  setErrorMsg('Não foi possível verificar o status agora.');
                } finally {
                  setLoadingProvider(null);
                }
              }}
              className="w-full py-3.5 px-5 rounded-2xl orca-gradient-btn text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loadingProvider === 'verify' ? 'animate-spin' : ''}`} />
              Já confirmei meu e-mail
            </button>
            <button
              type="button"
              disabled={loadingProvider === 'resend'}
              onClick={async () => {
                setLoadingProvider('resend');
                setErrorMsg(null);
                try {
                  await resendVerificationEmail();
                  setInfoMsg('Novo link de confirmação enviado!');
                } catch {
                  setErrorMsg('Aguarde alguns instantes antes de reenviar.');
                } finally {
                  setLoadingProvider(null);
                }
              }}
              className="w-full py-3 px-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-medium text-sm cursor-pointer disabled:opacity-60"
            >
              Reenviar e-mail de verificação
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleAuthError = (err: unknown) => {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
      setErrorMsg(
        'Este provedor ainda não está ativado no Firebase Console. Ative-o em Authentication > Sign-in method ou entre com Google.'
      );
    } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      setErrorMsg('E-mail ou senha incorretos.');
    } else if (code === 'auth/user-not-found') {
      setErrorMsg('Nenhuma conta encontrada com este e-mail.');
    } else if (code === 'auth/email-already-in-use') {
      setErrorMsg('Este e-mail já está cadastrado. Tente entrar na sua conta.');
    } else if (code === 'auth/weak-password') {
      setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
    } else if (code === 'auth/popup-closed-by-user') {
      setErrorMsg('Login cancelado antes da conclusão.');
    } else {
      setErrorMsg('Não foi possível autenticar agora. Tente novamente.');
    }
  };

  const handleGoogle = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setLoadingProvider('google');
    try {
      await signInWithGoogle();
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Preencha e-mail e senha para continuar.');
      return;
    }
    if (mode === 'register' && name.trim().length < 2) {
      setErrorMsg('Informe seu nome completo ou apelido esportivo.');
      return;
    }
    setLoadingProvider('email');
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(name, email, password);
        setInfoMsg('Conta criada! Confirme seu e-mail para entrar na rede.');
      }
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setLoadingProvider('reset');
    setErrorMsg(null);
    try {
      await sendPasswordReset(resetEmail);
      setInfoMsg(`Link de recuperação enviado para ${resetEmail.trim()}.`);
      setShowResetModal(false);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070B] text-slate-100 flex flex-col lg:flex-row">
      {/* Left Hero Panel (always visible on desktop, primary stage 1 on mobile) */}
      <div
        className={`relative flex-1 flex flex-col justify-between overflow-hidden min-h-screen lg:min-h-0 ${
          stage === 'form' ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <img
          src="/src/assets/images/orca_hero_athlete_1795818937554.jpg"
          alt="Atleta ORCA em estádio noturno"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06070B] via-[#06070B]/55 to-[#06070B]/40" />

        <div className="relative z-10 p-6 lg:p-12 flex items-center justify-between">
          <OrcaLogo size="sm" showTagline />
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-2 rounded-xl bg-black/40 border border-white/10 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            Ajuda
          </button>
        </div>

        <div className="relative z-10 px-6 pb-10 pt-16 lg:p-12 max-w-xl mx-auto lg:mx-0 w-full space-y-8">
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-4">
            <OrcaLogo size="lg" showTagline />
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-balance leading-tight">
              Entre na sua comunidade esportiva em tempo real.
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-md leading-relaxed">
              Descubra partidas reais acontecendo agora na sua cidade, conecte-se com atletas verificados e organize seus jogos pelo radar ao vivo.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/10">
            <div className="flex flex-col items-center lg:items-start gap-2 text-center lg:text-left">
              <Radio className="w-5 h-5 text-cyan-400" />
              <span className="text-xs font-medium text-slate-200 leading-snug">
                Eventos em tempo real
              </span>
            </div>
            <div className="flex flex-col items-center lg:items-start gap-2 text-center lg:text-left">
              <Users className="w-5 h-5 text-rose-400" />
              <span className="text-xs font-medium text-slate-200 leading-snug">
                Conecte-se com atletas
              </span>
            </div>
            <div className="flex flex-col items-center lg:items-start gap-2 text-center lg:text-left">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-medium text-slate-200 leading-snug">
                Seguro e verificado
              </span>
            </div>
          </div>

          {/* Mobile welcome CTAs */}
          <div className="space-y-3 lg:hidden">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setStage('form');
              }}
              className="w-full py-4 px-6 rounded-2xl orca-gradient-btn text-white font-display font-bold tracking-wide text-sm cursor-pointer shadow-lg shadow-rose-500/15"
            >
              COMEÇAR AGORA
            </button>
            <div className="text-center text-sm text-slate-400">
              Já tem uma conta?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setStage('form');
                }}
                className="text-cyan-400 font-semibold hover:underline cursor-pointer"
              >
                Entrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Auth Form Panel */}
      <div
        className={`w-full lg:w-[490px] xl:w-[520px] shrink-0 bg-[#090B10] border-l border-white/8 flex flex-col justify-between p-6 sm:p-10 min-h-screen ${
          stage === 'welcome' ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStage('welcome')}
            className="lg:hidden w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-200 cursor-pointer"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="hidden lg:block">
            <OrcaLogo size="sm" showTagline />
          </div>
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            Ajuda
          </button>
        </div>

        <div className="my-auto py-8 max-w-sm mx-auto w-full space-y-6">
          <div className="text-center lg:hidden">
            <OrcaLogo size="md" showTagline />
          </div>

          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#111520] border border-white/8">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              className={`py-2.5 text-xs font-display font-bold tracking-wider rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-[#192030] text-white border-b-2 border-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ENTRAR
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
              }}
              className={`py-2.5 text-xs font-display font-bold tracking-wider rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-[#192030] text-white border-b-2 border-rose-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              CRIAR CONTA
            </button>
          </div>

          {errorMsg && (
            <div className="text-xs text-rose-200 bg-rose-500/15 border border-rose-500/30 rounded-xl px-4 py-3 leading-relaxed">
              {errorMsg}
            </div>
          )}
          {infoMsg && (
            <div className="text-xs text-cyan-200 bg-cyan-500/15 border border-cyan-500/30 rounded-xl px-4 py-3 leading-relaxed">
              {infoMsg}
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold tracking-wider text-slate-400 block">
                  NOME DE ATLETA
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    autoComplete="name"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0F131D] border border-white/10 focus:border-cyan-400/70 focus:outline-none text-sm text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold tracking-wider text-slate-400 block">
                E-MAIL
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#0F131D] border border-white/10 focus:border-cyan-400/70 focus:outline-none text-sm text-white placeholder:text-slate-500"
                />
                {email.includes('@') && email.includes('.') && (
                  <Check className="w-4 h-4 text-emerald-400 absolute right-3.5" />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold tracking-wider text-slate-400 block">
                SENHA
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#0F131D] border border-white/10 focus:border-cyan-400/70 focus:outline-none text-sm text-white placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 text-slate-400 hover:text-white cursor-pointer p-1"
                  aria-label="Mostrar ou ocultar senha"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'login' && (
              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-white/20 bg-[#0F131D] accent-rose-500"
                  />
                  Lembrar de mim
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setShowResetModal(true);
                  }}
                  className="text-cyan-400 hover:underline font-medium cursor-pointer"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loadingProvider !== null}
              className="w-full py-3.5 px-5 rounded-2xl orca-gradient-btn text-white font-display font-bold text-sm tracking-wide flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-lg shadow-rose-500/15"
            >
              {loadingProvider === 'email'
                ? 'Conectando...'
                : mode === 'login'
                ? 'ENTRAR'
                : 'CRIAR CONTA'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] font-medium text-slate-500 tracking-wider">
              OU CONTINUE COM
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={loadingProvider !== null}
              onClick={handleGoogle}
              className="w-full py-3 px-4 rounded-xl bg-[#111520] hover:bg-[#171D2C] border border-white/10 text-sm font-medium text-white flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-60"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              {loadingProvider === 'google' ? 'Conectando Google...' : 'Continuar com Google'}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 pt-4">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Autenticação real via Firebase · Sessão persistente</span>
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full rounded-3xl bg-[#0E1117] border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-bold">Recuperar senha</h3>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="p-2 rounded-full hover:bg-white/10 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Informe o e-mail da sua conta para enviarmos um link real de redefinição de senha.
            </p>
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full px-4 py-3 rounded-xl bg-[#090B10] border border-white/10 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loadingProvider === 'reset'}
                className="w-full py-3 rounded-xl orca-gradient-btn text-white text-sm font-semibold cursor-pointer"
              >
                {loadingProvider === 'reset' ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-[#0E1117] border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-bold">Sobre o Acesso ORCA</h3>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-2 rounded-full hover:bg-white/10 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              O ORCA Conecta Sports utiliza contas 100% reais via Firebase Authentication. Entre com sua conta Google para começar imediatamente ou crie uma conta com e-mail verificado.
            </p>
            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold text-white cursor-pointer"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
