import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import useModalAccessibility from '../hooks/useModalAccessibility';

export default function AuthModal() {
  const { isAuthOpen, closeModals, openRegisterModal, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const isEmailValid = /\S+@\S+\.\S+/.test(email);
  const displayedEmailError = emailError || (emailTouched
    ? !email ? 'Email is required.' : !isEmailValid ? 'Please enter a valid email address.' : ''
    : '');
  const showEmailError = Boolean(displayedEmailError);
  const showPasswordLengthError = passwordTouched && password.length < 3;
  const displayedPasswordError = passwordError || (showPasswordLengthError ? 'At least 3 characters' : '');
  const passwordIsValid = passwordTouched && password.length >= 3 && !passwordError;
  const dialogRef = useModalAccessibility(isAuthOpen, closeModals);

  if (!isAuthOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (submitLock.current) return;
    setEmailTouched(true);
    setPasswordTouched(true);
    setEmailError('');
    setPasswordError('');
    setGeneralError('');

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setEmailError(email ? 'Please enter a valid email address.' : 'Email is required.');
      return;
    }
    if (!password || password.length < 3) {
      setPasswordError('At least 3 characters');
      return;
    }

    try {
      submitLock.current = true;
      setSubmitting(true);
      await login(email, password);
    } catch (err) {
      const status = err.response?.status;
      const fieldErrors = err.response?.data?.errors;
      const firstError = (value) => Array.isArray(value) ? value[0] : value;
      if (fieldErrors && (fieldErrors.email || fieldErrors.password)) {
        setEmailError(firstError(fieldErrors.email) || '');
        setPasswordError(firstError(fieldErrors.password) || '');
      } else if (status === 401 || status === 422) {
        setPasswordError(err.response?.data?.message || 'Invalid email or password.');
      } else {
        setGeneralError(err.response?.data?.message || 'Unable to log in. Please try again.');
      }
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-[5px]"
      onClick={closeModals}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-[403px] rounded-[22px] border border-[#292c3e] bg-[#080c1c] px-[26px] pb-[23px] pt-[29px] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeModals}
          type="button"
          aria-label="Close login"
          className="absolute right-[25px] top-[26px] flex h-6 w-6 items-center justify-center text-gray-300 transition hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <header>
          <h2 id="login-title" className="text-[24px] font-bold leading-[30px]">Log in</h2>
          <p className="mt-[5px] text-[13px] leading-[18px] text-[#a4a5af]">Welcome back to Kino XII</p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="mt-[15px]">
          {generalError && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <p role="alert">{generalError}</p>
            <button type="button" onClick={() => handleSubmit()} disabled={submitting} className="mt-2 font-semibold underline disabled:opacity-50">{submitting ? 'Retrying...' : 'Retry login'}</button>
          </div>}
          <div>
            <label htmlFor="login-email" className={`mb-[7px] block text-[13px] font-semibold leading-[17px] ${showEmailError ? 'text-[#ff321b]' : 'text-white'}`}>
              Email
            </label>
            <div className="relative">
              <input
                id="login-email"
                type="email"
                value={email}
                onBlur={() => setEmailTouched(true)}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError('');
                }}
                placeholder="example@gmail.com"
                aria-invalid={showEmailError}
                aria-describedby={showEmailError ? 'login-email-error' : undefined}
                autoComplete="email"
                className={`h-[46px] w-full rounded-[15px] border bg-[#1d1e2d] px-[18px] pr-12 text-[13px] font-medium text-white outline-none transition placeholder:text-[#b4b4bc] ${
                  showEmailError ? 'border-[#ff321b] text-[#ff321b]' : emailTouched && isEmailValid ? 'border-emerald-500' : 'border-transparent focus:border-white/30'
                }`}
              />
              {isEmailValid && (
                <svg viewBox="0 0 24 24" className="absolute right-[17px] top-1/2 h-[19px] w-[19px] -translate-y-1/2 text-[#2ddc8b]" fill="none" aria-label="Valid email">
                  <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            {showEmailError && <p id="login-email-error" className="mt-[7px] text-[12px] font-medium text-[#ff321b]">{displayedEmailError}</p>}
          </div>

          <div className="mt-[20px]">
            <label htmlFor="login-password" className={`mb-[7px] block text-[13px] font-semibold leading-[17px] ${displayedPasswordError ? 'text-[#ff321b]' : 'text-white'}`}>
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type="password"
                value={password}
                onBlur={() => setPasswordTouched(true)}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setPasswordError('');
                }}
                placeholder="••••••••"
                aria-invalid={Boolean(displayedPasswordError)}
                aria-describedby={displayedPasswordError ? 'login-password-error' : undefined}
                autoComplete="current-password"
                className={`h-[46px] w-full rounded-[15px] border bg-[#1d1e2d] px-[18px] pr-12 text-[13px] font-medium text-white outline-none transition placeholder:text-[#b4b4bc] ${
                  displayedPasswordError ? 'border-[#ff321b] text-[#ff321b] placeholder:text-[#ff321b]' : passwordIsValid ? 'border-emerald-500' : 'border-transparent focus:border-white/30'
                }`}
              />
              {displayedPasswordError && (
                <svg viewBox="0 0 24 24" className="absolute right-[17px] top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#ff321b]" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M12 7v6m0 3h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </div>
            {displayedPasswordError && <p id="login-password-error" className="mt-[7px] text-[12px] font-medium leading-[15px] text-[#ff321b]">{displayedPasswordError}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            aria-live="polite"
            className="mt-[25px] h-[46px] w-full rounded-full bg-[#f12d13] text-[14px] font-bold text-white transition hover:bg-[#dc260e] disabled:cursor-wait disabled:opacity-60"
          >
            <span role={submitting ? 'status' : undefined}>{submitting ? 'Connecting...' : 'Log in'}</span>
          </button>
        </form>

        <div className="mt-[25px] flex items-center justify-between gap-3 text-[13px] leading-5 text-[#a4a5af]">
          <span>Don&apos;t have an account?{' '}
            <button onClick={openRegisterModal} type="button" className="font-bold text-[#ff321b] hover:text-[#ff5845]">
              Sign up
            </button>
          </span>
          <button onClick={closeModals} type="button" className="shrink-0 font-semibold text-gray-300 hover:text-white">Close</button>
        </div>
      </div>
    </div>
  );
}