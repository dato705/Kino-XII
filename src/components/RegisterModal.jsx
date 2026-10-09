import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
  const [generalError, setGeneralError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isEmailValid = /\S+@\S+\.\S+/.test(email);
  const isFormValid = username.trim().length >= 3 && isEmailValid && password.length >= 3 && password === confirmPassword;

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
    e.preventDefault();
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
          ...serverErrors,
          confirmPassword: serverErrors.password_confirmation,
        });
      } else {
        setGeneralError(err.response?.data?.message || 'Unable to create your account. Please try again.');
      }
    } finally {
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
              onChange={(e) => setUsername(e.target.value)}
              placeholder="User"
              autoComplete="username"
              aria-invalid={Boolean(errors.username)}
              className={`h-[46px] w-full rounded-[14px] border bg-[#1d1e2d] px-[18px] text-[13px] font-medium text-white outline-none transition placeholder:text-[#b4b4bc] ${errors.username ? 'border-[#ff321b]' : 'border-transparent focus:border-white/30'}`}
            />
            {errors.username && <p className="mt-1 text-[11px] text-red-400">{Array.isArray(errors.username) ? errors.username[0] : errors.username}</p>}
          </div>

          <div className="mt-[28px]">
            <label htmlFor="register-email" className="mb-[8px] block text-[13px] font-semibold leading-[17px]">Email</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              className={`h-[46px] w-full rounded-[14px] border bg-[#1d1e2d] px-[18px] text-[13px] font-medium text-white outline-none transition placeholder:text-[#b4b4bc] ${errors.email ? 'border-[#ff321b]' : 'border-transparent focus:border-white/30'}`}
            />
            {errors.email && <p className="mt-1 text-[11px] text-red-400">{Array.isArray(errors.email) ? errors.email[0] : errors.email}</p>}
          </div>

          <div className="mt-[28px] grid grid-cols-1 gap-[14px] sm:grid-cols-2">
            <div>
              <label htmlFor="register-password" className="mb-[8px] block text-[13px] font-semibold leading-[17px]">Password</label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                className={`h-[46px] w-full rounded-[14px] border bg-[#1d1e2d] px-[18px] text-[13px] font-medium text-white outline-none transition placeholder:text-[#b4b4bc] ${errors.password ? 'border-[#ff321b]' : 'border-transparent focus:border-white/30'}`}
              />
              {errors.password && <p className="mt-1 text-[11px] text-red-400">{Array.isArray(errors.password) ? errors.password[0] : errors.password}</p>}
            </div>

            <div>
              <label htmlFor="register-confirm-password" className="mb-[8px] block text-[13px] font-semibold leading-[17px]">Confirm password</label>
              <input
                id="register-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmPassword)}
                className={`h-[46px] w-full rounded-[14px] border bg-[#1d1e2d] px-[18px] text-[13px] font-medium text-white outline-none transition placeholder:text-[#b4b4bc] ${errors.confirmPassword ? 'border-[#ff321b]' : 'border-transparent focus:border-white/30'}`}
              />
              {errors.confirmPassword && <p className="mt-1 text-[11px] text-red-400">{Array.isArray(errors.confirmPassword) ? errors.confirmPassword[0] : errors.confirmPassword}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !isFormValid}
            className={`mt-[38px] h-[46px] w-full rounded-full text-[14px] font-bold transition disabled:cursor-not-allowed ${isFormValid && !submitting ? 'bg-[#f12d13] text-white hover:bg-[#dc260e]' : 'bg-[#50515e] text-[#a2a2aa]'}`}
          >
            {submitting ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <div className="mt-[32px] text-center text-[15px] leading-5 text-[#a4a5af]">
          Already have an account?{' '}
          <button onClick={openAuthModal} type="button" className="font-bold text-[#ff321b] hover:text-[#ff5845]">
            Log in
          </button>
        </div>
      </section>
    </div>
  );
}