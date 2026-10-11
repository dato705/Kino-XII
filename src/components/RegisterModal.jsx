import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useModalAccessibility from '../hooks/useModalAccessibility';

const getErrorText = (value) => Array.isArray(value) ? value[0] : value;

export default function RegisterModal() {
  const { isRegisterOpen, closeModals, openAuthModal, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const isEmailValid = /\S+@\S+\.\S+/.test(email);
  const isFormValid = username.trim().length >= 3 && isEmailValid && password.length >= 3 && password === confirmPassword;
  const usernameError = getErrorText(errors.username) || (touched.username && username.trim().length < 3 ? 'Username must be at least 3 characters long.' : '');
  const emailError = getErrorText(errors.email) || (touched.email && !isEmailValid ? 'Please enter a valid email address.' : '');
  const passwordError = getErrorText(errors.password) || (touched.password && password.length < 3 ? 'Password must be at least 3 characters long.' : '');
  const confirmPasswordError = getErrorText(errors.confirmPassword) || (touched.confirmPassword && (!confirmPassword || password !== confirmPassword)
    ? confirmPassword ? 'Passwords do not match.' : 'Please confirm your password.'
    : '');
  const usernameValid = touched.username && username.trim().length >= 3 && !errors.username;
  const emailValid = touched.email && isEmailValid && !errors.email;
  const passwordValid = touched.password && password.length >= 3 && !errors.password;
  const confirmPasswordValid = touched.confirmPassword && Boolean(confirmPassword) && password === confirmPassword && !errors.confirmPassword;
  const dialogRef = useModalAccessibility(isRegisterOpen, closeModals);

  if (!isRegisterOpen) return null;

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setAvatar(null);
      setAvatarPreview(null);
      setErrors((prev) => ({ ...prev, avatar: 'Only JPG, PNG, or WEBP images are allowed.' }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatar(null);
      setAvatarPreview(null);
      setErrors((prev) => ({ ...prev, avatar: 'Avatar must be 2 MB or smaller.' }));
      return;
    }

    setErrors((prev) => ({ ...prev, avatar: null }));
    setAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (submitLock.current) return;
    setTouched({ username: true, email: true, password: true, confirmPassword: true });
    setErrors({});
    setGeneralError('');

    const newErrors = {};
    if (username.trim().length < 3) newErrors.username = 'Username must be at least 3 characters long.';
    if (!email || !/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Please enter a valid email address.';
    if (!password || password.length < 3) newErrors.password = 'Password must be at least 3 characters long.';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      submitLock.current = true;
      setSubmitting(true);
      const formData = new FormData();
      formData.append('username', username.trim());
      formData.append('email', email);
      formData.append('password', password);
      formData.append('password_confirmation', confirmPassword);
      if (avatar) formData.append('avatar', avatar);

      await register(formData);
      navigate('/profile', { replace: true, state: { from: location.pathname + location.search } });
    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      if (serverErrors) {
        setErrors({
          username: serverErrors.username,
          email: serverErrors.email,
          password: serverErrors.password,
          confirmPassword: serverErrors.confirmPassword ?? serverErrors.password_confirmation,
          avatar: serverErrors.avatar,
        });
      } else {
        setGeneralError(err.response?.data?.message || 'Unable to create your account. Please try again.');
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
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-title"
        ref={dialogRef}
        tabIndex={-1}
        className="relative max-h-[calc(100dvh-24px)] w-full max-w-[540px] overflow-y-auto rounded-[30px] border border-[#292c3e] bg-[#080c1c] px-9 pb-8 pt-8 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeModals}
          type="button"
          aria-label="Close sign up"
          className="absolute right-6 top-6 flex h-6 w-6 items-center justify-center text-gray-300 transition hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <header>
          <h2 id="register-title" className="text-[23px] font-bold leading-[30px]">Sign up</h2>
          <p className="mt-[4px] text-[13px] leading-[18px] text-[#a4a5af]">Welcome to Kino XII</p>
        </header>

        {generalError && (
          <div role="alert" className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
            {generalError}
            <button type="button" onClick={() => handleSubmit()} disabled={submitting} className="mt-2 block font-semibold underline disabled:opacity-50">{submitting ? 'Retrying...' : 'Retry sign up'}</button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-[25px]">
          <div className="flex min-h-[46px] items-center gap-[14px]">
            <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-[#202130] text-[#858692]">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
                  <path d="M12 15V4m0 0L8 8m4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <label className="block cursor-pointer text-[14px] font-bold leading-[19px] text-white hover:text-gray-200">
                Upload avatar (optional)
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="sr-only" />
              </label>
              <p className="mt-[2px] text-[12px] leading-[16px] text-[#a4a5af]">JPG, PNG or WEBP</p>
            </div>
          </div>
          {errors.avatar && <p className="mt-1 text-[11px] text-red-400">{Array.isArray(errors.avatar) ? errors.avatar[0] : errors.avatar}</p>}

          <div className="mt-[40px]">
            <label htmlFor="register-username" className="mb-[8px] block text-[13px] font-semibold leading-[17px]">Username</label>
            <input
              id="register-username"
              type="text"
              value={username}
              onBlur={() => setTouched((current) => ({ ...current, username: true }))}
              onChange={(e) => { setUsername(e.target.value); setErrors((current) => ({ ...current, username: undefined })); }}
              placeholder="User"
              autoComplete="username"
              aria-invalid={Boolean(usernameError)}
              aria-describedby={usernameError ? 'register-username-error' : undefined}
              className={`h-[46px] w-full rounded-[14px] border bg-[#1d1e2d] px-[18px] text-[13px] font-medium text-white outline-none transition placeholder:text-[#b4b4bc] ${usernameError ? 'border-[#ff321b]' : usernameValid ? 'border-emerald-500' : 'border-transparent focus:border-white/30'}`}
            />
            {usernameError && <p id="register-username-error" className="mt-1 text-[11px] text-red-400">{usernameError}</p>}
          </div>

          <div className="mt-[28px]">
            <label htmlFor="register-email" className="mb-[8px] block text-[13px] font-semibold leading-[17px]">Email</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onBlur={() => setTouched((current) => ({ ...current, email: true }))}
              onChange={(e) => { setEmail(e.target.value); setErrors((current) => ({ ...current, email: undefined })); }}
              placeholder="example@gmail.com"
              autoComplete="email"
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? 'register-email-error' : undefined}
              className={`h-[46px] w-full rounded-[14px] border bg-[#1d1e2d] px-[18px] text-[13px] font-medium text-white outline-none transition placeholder:text-[#b4b4bc] ${emailError ? 'border-[#ff321b]' : emailValid ? 'border-emerald-500' : 'border-transparent focus:border-white/30'}`}
            />
            {emailValid && <span className="mt-1 block text-[10px] font-medium text-emerald-400">Email looks good</span>}
            {emailError && <p id="register-email-error" className="mt-1 text-[11px] text-red-400">{emailError}</p>}
          </div>

          <div className="mt-[28px] grid grid-cols-1 gap-[14px] sm:grid-cols-2">
            <div>
              <label htmlFor="register-password" className="mb-[8px] block text-[13px] font-semibold leading-[17px]">Password</label>
              <input
                id="register-password"
                type="password"
                value={password}
                onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                onChange={(e) => { setPassword(e.target.value); setErrors((current) => ({ ...current, password: undefined })); }}
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? 'register-password-error' : undefined}
                className={`h-[46px] w-full rounded-[14px] border bg-[#1d1e2d] px-[18px] text-[13px] font-medium text-white outline-none transition placeholder:text-[#b4b4bc] ${passwordError ? 'border-[#ff321b]' : passwordValid ? 'border-emerald-500' : 'border-transparent focus:border-white/30'}`}
              />
              {passwordValid && <span className="mt-1 block text-[10px] font-medium text-emerald-400">Password looks good</span>}
              {passwordError && <p id="register-password-error" className="mt-1 text-[11px] text-red-400">{passwordError}</p>}
            </div>

            <div>
              <label htmlFor="register-confirm-password" className="mb-[8px] block text-[13px] font-semibold leading-[17px]">Confirm password</label>
              <input
                id="register-confirm-password"
                type="password"
                value={confirmPassword}
                onBlur={() => setTouched((current) => ({ ...current, confirmPassword: true }))}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrors((current) => ({ ...current, confirmPassword: undefined })); }}
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={Boolean(confirmPasswordError)}
                aria-describedby={confirmPasswordError ? 'register-confirm-password-error' : undefined}
                className={`h-[46px] w-full rounded-[14px] border bg-[#1d1e2d] px-[18px] text-[13px] font-medium text-white outline-none transition placeholder:text-[#b4b4bc] ${confirmPasswordError ? 'border-[#ff321b]' : confirmPasswordValid ? 'border-emerald-500' : 'border-transparent focus:border-white/30'}`}
              />
              {confirmPasswordError && <p id="register-confirm-password-error" className="mt-1 text-[11px] text-red-400">{confirmPasswordError}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !isFormValid}
            aria-live="polite"
            className={`mt-[38px] h-[46px] w-full rounded-full text-[14px] font-bold transition disabled:cursor-not-allowed ${isFormValid && !submitting ? 'bg-[#f12d13] text-white hover:bg-[#dc260e]' : 'bg-[#50515e] text-[#a2a2aa]'}`}
          >
            <span role={submitting ? 'status' : undefined}>{submitting ? 'Creating account...' : 'Sign up'}</span>
          </button>
        </form>

        <div className="mt-[32px] flex items-center justify-between gap-3 text-[13px] leading-5 text-[#a4a5af]">
          <span>Already have an account?{' '}
            <button onClick={openAuthModal} type="button" className="font-bold text-[#ff321b] hover:text-[#ff5845]">
              Log in
            </button>
          </span>
          <button onClick={closeModals} type="button" className="shrink-0 font-semibold text-gray-300 hover:text-white">Close</button>
        </div>
      </section>
    </div>
  );
}