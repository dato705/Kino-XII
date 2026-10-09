import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const profileKey = [user?.id, user?.email, user?.fullName, user?.mobileNumber, user?.dateOfBirth].join(':');
  return <ProfileForm key={profileKey} user={user} updateProfile={updateProfile} />;
}

function ProfileForm({ user, updateProfile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(user?.fullName || user?.name || user?.username || '');
  const [mobileNumber, setMobileNumber] = useState(user?.mobileNumber || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || '');
  const [avatar, setAvatar] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setError('');
    setSaving(true);

    const profile = new FormData();
    profile.append('fullName', fullName.trim());
    profile.append('mobileNumber', mobileNumber.trim());
    profile.append('dateOfBirth', dateOfBirth);
    if (avatar) profile.append('avatar', avatar);

    try {
      await updateProfile(profile);
      navigate(location.state?.from || '/', { replace: true });
    } catch (requestError) {
      const responseErrors = requestError.response?.data?.errors;
      if (responseErrors) setErrors(responseErrors);
      else setError(requestError.response?.data?.message || 'Your profile could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderFieldError = (field) => {
    const message = errors[field];
    if (!message) return null;
    return <p className="mt-1 text-xs text-red-400">{Array.isArray(message) ? message[0] : message}</p>;
  };

  return (
    <section className="mx-auto max-w-2xl space-y-6 py-4 text-white">
      <div>
        <Link to="/" className="text-sm font-semibold text-gray-400 hover:text-white">← Back to movies</Link>
        <h1 className="mt-5 text-2xl font-black uppercase">Complete your profile</h1>
        <p className="mt-2 text-sm text-gray-400">Your name, mobile number, and date of birth are required before booking.</p>
      </div>

      {!user?.profileComplete && (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
          Complete these details to reserve cinema seats.
        </p>
      )}
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-5 border-y border-gray-800 py-6">
        <label className="block space-y-2 text-sm font-semibold">
          <span>Full name</span>
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" className="w-full rounded-lg border border-gray-800 bg-[#161B26] px-4 py-3 text-white outline-none focus:border-red-500" />
          {renderFieldError('fullName')}
        </label>

        <label className="block space-y-2 text-sm font-semibold">
          <span>Mobile number</span>
          <input value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} type="tel" autoComplete="tel" placeholder="599 123 456" className="w-full rounded-lg border border-gray-800 bg-[#161B26] px-4 py-3 text-white outline-none focus:border-red-500" />
          {renderFieldError('mobileNumber')}
        </label>

        <label className="block space-y-2 text-sm font-semibold">
          <span>Date of birth</span>
          <input value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} type="date" autoComplete="bday" className="w-full rounded-lg border border-gray-800 bg-[#161B26] px-4 py-3 text-white outline-none focus:border-red-500" />
          {renderFieldError('dateOfBirth')}
        </label>

        <label className="block space-y-2 text-sm font-semibold">
          <span>Profile photo <span className="font-normal text-gray-500">(optional)</span></span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAvatar(event.target.files?.[0] || null)} className="block w-full text-sm text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:font-semibold file:text-white" />
          {renderFieldError('avatar')}
        </label>

        <button type="submit" disabled={saving} className="rounded-lg bg-red-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50">
          {saving ? 'Saving profile...' : 'Save profile'}
        </button>
      </form>
    </section>
  );
}