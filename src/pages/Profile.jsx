import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getFilterOptions, getMyTickets, refundOrder } from '../api/cinema';
import { useAuth } from '../context/AuthContext';

const unwrap = (response) => response?.data?.data ?? response?.data ?? response;
const TODAY = new Date();
const TODAY_ISO = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}-${String(TODAY.getDate()).padStart(2, '0')}`;
const BIRTHDAY_LIMIT = new Date(TODAY.getFullYear() - 12, TODAY.getMonth(), TODAY.getDate());
const BIRTHDAY_MAX = `${BIRTHDAY_LIMIT.getFullYear()}-${String(BIRTHDAY_LIMIT.getMonth() + 1).padStart(2, '0')}-${String(BIRTHDAY_LIMIT.getDate()).padStart(2, '0')}`;
const profileInputStyle = { height: 42, backgroundColor: '#1c1e30', borderRadius: 10 };

const getOrderList = (response) => {
  const payload = unwrap(response);
  if (Array.isArray(payload)) return payload;
  return payload?.orders || payload?.tickets || [];
};

const formatMobileNumber = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
};

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = TODAY;
  let age = today.getFullYear() - birthDate.getFullYear();
  if (today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
};

const getSessionStart = (session) => session?.startsAt || session?.starts_at || session?.start_time || session?.datetime || session?.date;

const formatSessionDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
};

const getOrderReference = (order) => order.reference || order.code || order.id;
const getOrderKey = (order) => String(order.id ?? order.reference ?? order.code);

export default function Profile() {
  const { user, token, openAuthModal, updateProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'tickets' ? 'tickets' : 'personal';
  const setActiveTab = (tab) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'tickets') nextParams.set('tab', 'tickets');
    else nextParams.delete('tab');
    setSearchParams(nextParams);
  };
  const authRequested = useRef(false);

  useEffect(() => {
    if (token) {
      authRequested.current = false;
      return;
    }
    if (!authRequested.current) {
      authRequested.current = true;
      openAuthModal();
    }
  }, [token, openAuthModal]);

  if (!token || !user) {
    return (
      <section className="mx-auto max-w-5xl py-16 text-center text-white">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="mt-2 text-sm text-gray-400">Log in to manage your profile and tickets.</p>
        <button type="button" onClick={() => openAuthModal()} className="mt-5 rounded-full bg-[#f12d13] px-5 py-2.5 text-xs font-bold text-white hover:bg-red-600">Log in</button>
      </section>
    );
  }

  const profileKey = [user.id, user.email, user.fullName, user.mobileNumber, user.dateOfBirth, user.preferredVenueId].join(':');

  return (
    <ProfilePage
      key={profileKey}
      user={user}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      updateProfile={updateProfile}
    />
  );
}

function ProfilePage({ user, activeTab, setActiveTab, updateProfile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(user.fullName || user.name || user.username || '');
  const [mobileNumber, setMobileNumber] = useState(formatMobileNumber(user.mobileNumber || ''));
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth || user.date_of_birth || '');
  const [preferredVenueId, setPreferredVenueId] = useState(String(user.preferredVenueId ?? user.preferred_venue_id ?? user.preferredVenue?.id ?? ''));
  const [venues, setVenues] = useState([]);
  const [venueLoadError, setVenueLoadError] = useState('');
  const [serverErrors, setServerErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [profileError, setProfileError] = useState('');
  const [saving, setSaving] = useState(false);
  const [ticketTab, setTicketTab] = useState('upcoming');
  const [ticketOrders, setTicketOrders] = useState([]);
  const [recentlyRefunded, setRecentlyRefunded] = useState([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [loadedTicketKey, setLoadedTicketKey] = useState('');
  const [ticketsError, setTicketsError] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [refunding, setRefunding] = useState('');
  const [ticketRequestId, setTicketRequestId] = useState(0);
  const ticketKey = `${ticketTab}:${ticketRequestId}`;
  const ticketsLoading = loadedTicketKey !== ticketKey;

  useEffect(() => {
    let cancelled = false;
    getFilterOptions()
      .then((response) => {
        const options = unwrap(response)?.filter_options || unwrap(response);
        if (!cancelled) setVenues(options?.venues || []);
      })
      .catch(() => {
        if (!cancelled) setVenueLoadError('Preferred venues could not be loaded.');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMyTickets(ticketTab)
      .then((response) => {
        if (cancelled) return;
        const orders = getOrderList(response);
        if (ticketTab === 'upcoming') setUpcomingCount(orders.length);
        const visibleOrders = ticketTab === 'past'
          ? [...recentlyRefunded, ...orders].filter((order, index, all) => all.findIndex((candidate) => getOrderKey(candidate) === getOrderKey(order)) === index)
          : orders;
        setTicketOrders(visibleOrders);
        setTicketsError('');
        setLoadedTicketKey(ticketKey);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setTicketOrders([]);
          setTicketsError(requestError.response?.data?.message || 'Your tickets could not be loaded. Please try again.');
          setLoadedTicketKey(ticketKey);
        }
      });
    return () => { cancelled = true; };
  }, [ticketTab, ticketRequestId, recentlyRefunded, ticketKey]);

  const currentAge = Number(user.age ?? calculateAge(dateOfBirth));
  const fullNameError = !fullName.trim()
    ? 'Name is required'
    : fullName.trim().length < 3
      ? 'Name must be at least 3 characters'
      : fullName.trim().length > 50
        ? 'Name must not exceed 50 characters'
        : '';
  const mobileDigits = mobileNumber.replace(/\D/g, '');
  const mobileError = !mobileDigits
    ? 'Mobile number is required'
    : !mobileDigits.startsWith('5')
      ? 'Georgian mobile numbers must start with 5'
      : mobileDigits.length !== 9
        ? 'Mobile number must be exactly 9 digits'
        : '';
  const birthDateIsFuture = Boolean(dateOfBirth && dateOfBirth > TODAY_ISO);
  const birthAge = calculateAge(dateOfBirth);
  const dateOfBirthError = !dateOfBirth
    ? 'Date of birth is required'
    : birthDateIsFuture
      ? 'Please enter a valid date of birth'
      : birthAge < 12
        ? 'You must be at least 12 years old to create an account'
        : '';
  const validationErrors = { fullName: fullNameError, mobileNumber: mobileError, dateOfBirth: dateOfBirthError };
  const formIsValid = !Object.values(validationErrors).some(Boolean);
  const profileComplete = Boolean(user.profileComplete ?? formIsValid);
  const initialState = [user.fullName || user.name || user.username || '', (user.mobileNumber || '').replace(/\D/g, ''), user.dateOfBirth || user.date_of_birth || '', String(user.preferredVenueId ?? user.preferred_venue_id ?? user.preferredVenue?.id ?? '')].join('|');
  const currentState = [fullName.trim(), mobileDigits, dateOfBirth, preferredVenueId].join('|');
  const hasChanges = currentState !== initialState;
  const displayedAge = Number.isFinite(currentAge) ? currentAge : null;
  const eligibilityMessage = displayedAge === null
    ? ''
    : displayedAge < 16
      ? `You are ${displayedAge}; you cannot buy tickets for 16+ or 18+ titles.`
      : displayedAge < 18
        ? `You are ${displayedAge}; you cannot buy tickets for 18+ titles.`
        : `You are ${displayedAge}; you can buy tickets for all age ratings.`;

  const markTouched = (field) => setTouched((current) => ({ ...current, [field]: true }));
  const renderFieldError = (field) => {
    const message = serverErrors[field] || (touched[field] ? validationErrors[field] : '');
    return message ? <span className="block text-[10px] font-normal text-red-400">{Array.isArray(message) ? message[0] : message}</span> : null;
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setTouched({ fullName: true, mobileNumber: true, dateOfBirth: true });
    setServerErrors({});
    setProfileError('');
    if (!formIsValid || !hasChanges) return;

    const profile = new FormData();
    profile.append('fullName', fullName.trim());
    profile.append('mobileNumber', mobileDigits);
    profile.append('dateOfBirth', dateOfBirth);
    profile.append('preferredVenueId', preferredVenueId);
    setSaving(true);
    try {
      await updateProfile(profile);
      if (location.state?.from) navigate(location.state.from, { replace: true });
    } catch (requestError) {
      const errors = requestError.response?.data?.errors;
      if (errors) setServerErrors(errors);
      else setProfileError(requestError.response?.data?.message || 'Your profile could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRefund = async (order) => {
    const reference = getOrderReference(order);
    if (!reference || !order.isRefundable || !window.confirm(`Refund order ${reference}? This action cannot be undone.`)) return;
    setRefunding(String(reference));
    setTicketMessage('');
    setTicketsError('');
    try {
      const response = await refundOrder(reference);
      const updatedOrder = unwrap(response)?.order || unwrap(response);
      setRecentlyRefunded((current) => [updatedOrder, ...current.filter((item) => getOrderKey(item) !== getOrderKey(updatedOrder))]);
      setTicketOrders((current) => current.filter((item) => getOrderKey(item) !== getOrderKey(updatedOrder)));
      setUpcomingCount((count) => Math.max(0, count - 1));
      setTicketMessage(`Order ${getOrderReference(updatedOrder)} was refunded.`);
      if (ticketTab === 'past') setTicketRequestId((value) => value + 1);
    } catch (requestError) {
      setTicketsError(requestError.response?.data?.message || 'The refund could not be completed. Please try again.');
    } finally {
      setRefunding('');
    }
  };

  return (
    <section className="mx-auto min-h-[calc(100vh-140px)] max-w-[1920px] px-3 pb-8 text-white sm:px-4">
      <header className="border-b border-gray-800 pb-0">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">My Profile</h1>
          <span className={`hidden items-center gap-1.5 text-[10px] font-semibold sm:flex ${profileComplete ? 'text-emerald-400' : 'text-amber-400'}`}>
            <i className={`h-2 w-2 rounded-full ${profileComplete ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {profileComplete ? 'Profile Complete ✓' : 'Profile Incomplete'}
          </span>
        </div>
        <div role="tablist" aria-label="Profile sections" className="mt-3 flex gap-5">
          <button type="button" role="tab" aria-selected={activeTab === 'personal'} onClick={() => setActiveTab('personal')} className={`border-b-2 px-0.5 pb-3 text-sm transition ${activeTab === 'personal' ? 'border-[#f12d13] text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>Personal Information</button>
          <button type="button" role="tab" aria-selected={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} className={`flex items-center gap-1.5 border-b-2 px-0.5 pb-3 text-sm transition ${activeTab === 'tickets' ? 'border-[#f12d13] text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>
            My Tickets
            {upcomingCount > 0 && <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#f12d13] px-1 text-[8px] text-white">{upcomingCount}</span>}
          </button>
        </div>
      </header>

      {activeTab === 'personal' ? (
        <div className="pt-7">
          <div className="w-full" style={{ maxWidth: 920 }}>
            {!profileComplete && <p className="mb-5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-300">Please complete your profile to enable booking.</p>}
            {profileComplete && displayedAge !== null && displayedAge < 18 && <p className="mb-5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-300">{eligibilityMessage}</p>}
            {profileError && <p role="alert" className="mb-4 rounded-lg bg-red-500/10 p-3 text-[10px] text-red-300">{profileError}</p>}

            <form onSubmit={handleProfileSubmit} className="space-y-5">
              <label className="block space-y-2 text-xs font-medium">
                <span>Full name</span>
                <input
                  value={fullName}
                  onBlur={() => markTouched('fullName')}
                  onChange={(event) => { setFullName(event.target.value); setServerErrors((current) => ({ ...current, fullName: undefined })); }}
                  autoComplete="name"
                  maxLength={50}
                  aria-invalid={Boolean(serverErrors.fullName || (touched.fullName && fullNameError))}
                  style={profileInputStyle}
                  className={`h-[42px] w-full rounded-[10px] border bg-[#1c1e30] px-4 text-xs outline-none focus:border-gray-600 ${serverErrors.fullName || (touched.fullName && fullNameError) ? 'border-red-500' : 'border-transparent'}`}
                />
                {renderFieldError('fullName')}
              </label>

              <label className="block space-y-2 text-xs font-medium">
                <span>Email</span>
                <input value={user.email || ''} readOnly disabled style={profileInputStyle} className="h-[42px] w-full cursor-not-allowed rounded-[10px] border border-transparent bg-[#1c1e30] px-4 text-xs text-gray-400 opacity-80" />
                <span className="block text-[11px] text-gray-400">Set at registration and cannot be changed</span>
              </label>

              <label className="block space-y-2 text-xs font-medium">
                <span>Mobile number</span>
                <input
                  value={mobileNumber}
                  onBlur={() => markTouched('mobileNumber')}
                  onChange={(event) => { setMobileNumber(formatMobileNumber(event.target.value)); setServerErrors((current) => ({ ...current, mobileNumber: undefined })); }}
                  type="tel"
                  autoComplete="tel"
                  inputMode="numeric"
                  placeholder="555 123 456"
                  aria-invalid={Boolean(serverErrors.mobileNumber || (touched.mobileNumber && mobileError))}
                  style={profileInputStyle}
                  className={`h-[42px] w-full rounded-[10px] border bg-[#1c1e30] px-4 text-xs outline-none focus:border-gray-600 ${serverErrors.mobileNumber || (touched.mobileNumber && mobileError) ? 'border-red-500' : 'border-transparent'}`}
                />
                {renderFieldError('mobileNumber')}
              </label>

              <label className="block space-y-2 text-xs font-medium">
                <span>Date of birth</span>
                <input
                  value={dateOfBirth}
                  onBlur={() => markTouched('dateOfBirth')}
                  onChange={(event) => { setDateOfBirth(event.target.value); setServerErrors((current) => ({ ...current, dateOfBirth: undefined })); }}
                  type="date"
                    max={BIRTHDAY_MAX}
                  autoComplete="bday"
                  aria-invalid={Boolean(serverErrors.dateOfBirth || (touched.dateOfBirth && dateOfBirthError))}
                    style={profileInputStyle}
                  className={`h-[42px] w-full rounded-[10px] border bg-[#1c1e30] px-4 text-xs outline-none focus:border-gray-600 [color-scheme:dark] ${serverErrors.dateOfBirth || (touched.dateOfBirth && dateOfBirthError) ? 'border-red-500' : 'border-transparent'}`}
                />
                {renderFieldError('dateOfBirth')}
              </label>

              <label className="block space-y-2 text-xs font-medium">
                <span>Preferred Venue (Optional)</span>
                <select value={preferredVenueId} onChange={(event) => setPreferredVenueId(event.target.value)} style={profileInputStyle} className="h-[42px] w-full rounded-[10px] border border-transparent bg-[#1c1e30] px-4 text-xs text-white outline-none focus:border-gray-600">
                  <option value="">No preferred venue</option>
                  {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name} · {venue.city}</option>)}
                </select>
                {venueLoadError && <span className="block text-[9px] text-gray-500">{venueLoadError}</span>}
              </label>

              <button type="submit" disabled={!hasChanges || !formIsValid || saving} style={{ height: 42, minWidth: 150 }} className="mt-2 h-[42px] rounded-full bg-[#f12d13] px-6 text-xs font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-45">
                {saving ? 'Saving changes...' : 'Save changes'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <section className="pt-5" aria-label="My tickets">
          <div className="mb-4 flex items-center gap-1 rounded-lg bg-[#1c1e30] p-1 text-[9px]">
            <button type="button" aria-pressed={ticketTab === 'upcoming'} onClick={() => { setTicketTab('upcoming'); setTicketMessage(''); }} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${ticketTab === 'upcoming' ? 'bg-[#292c3e] text-white' : 'text-gray-400 hover:text-white'}`}>Upcoming <span>{ticketTab === 'upcoming' ? ticketOrders.length : upcomingCount}</span></button>
            <button type="button" aria-pressed={ticketTab === 'past'} onClick={() => { setTicketTab('past'); setTicketMessage(''); }} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${ticketTab === 'past' ? 'bg-[#292c3e] text-white' : 'text-gray-400 hover:text-white'}`}>Past</button>
          </div>
          {ticketMessage && <p role="status" className="mb-3 rounded-lg bg-emerald-500/10 p-3 text-[10px] text-emerald-300">{ticketMessage}</p>}
          {ticketsError && <p role="alert" className="mb-3 rounded-lg bg-red-500/10 p-3 text-[10px] text-red-300">{ticketsError}</p>}
          {ticketsLoading ? <p className="py-12 text-center text-xs text-gray-400">Loading tickets...</p> : ticketOrders.length ? (
            <div className="space-y-3">
              {ticketOrders.map((order) => {
                const session = order.session || {};
                const movie = session.movie || order.movie || {};
                const poster = movie.posterUrl || movie.poster_url || movie.cover;
                const title = movie.title || session.movie_title || 'Cinema session';
                const start = getSessionStart(session);
                const hall = session.hall?.name || session.auditorium?.name || session.room?.name || '';
                const venue = session.venue?.name || session.hall?.venue?.name || session.venueName || 'Cinema';
                const format = session.format?.name || session.format || '—';
                const language = session.language?.name || session.language || '—';
                const refundDisabled = ticketTab === 'upcoming' && !order.isRefundable;
                return (
                  <article key={getOrderKey(order)} className="profile-ticket-card rounded-2xl bg-[#1c1e30] p-3 sm:p-4">
                    {poster ? <img src={poster} alt="" className="profile-ticket-poster rounded-md object-cover" /> : <span className="profile-ticket-poster rounded-md bg-[#292c3e]" />}
                    <div className="profile-ticket-main min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xs font-bold">{title}</h3>
                        {movie.ageRating?.code && <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[8px] text-red-400">{movie.ageRating.code}</span>}
                        {movie.runtimeMinutes && <span className="text-[9px] text-gray-400">{movie.runtimeMinutes} min</span>}
                      </div>
                      <div className="mt-2 grid gap-x-4 gap-y-2 text-[9px] sm:grid-cols-3">
                        <div><p className="uppercase text-gray-500">Date</p><p className="mt-0.5 text-gray-200">{formatSessionDate(start)}</p></div>
                        <div><p className="uppercase text-gray-500">Venue</p><p className="mt-0.5 text-gray-200">{venue}{hall ? ` · Hall ${hall}` : ''}</p></div>
                        <div><p className="uppercase text-gray-500">Format</p><p className="mt-0.5 text-gray-200">{format} · {language}</p></div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1 text-[8px]">
                        <span className="mr-1 uppercase text-gray-500">Seats</span>
                        {(order.tickets || []).map((ticket) => <span key={ticket.id || ticket.seatCode} className="rounded bg-[#2b2e40] px-1.5 py-1 text-gray-200">{ticket.seatCode} · {ticket.ticketType?.name || ticket.ticketType || 'Adult'}</span>)}
                      </div>
                    </div>
                    <div className="profile-ticket-order flex items-center justify-between gap-3 border-t border-white/5 pt-3 sm:pl-4 sm:pt-0">
                      <div><p className="text-[8px] uppercase text-gray-500">Order</p><p className="text-[9px] font-semibold">#{getOrderReference(order)}</p></div>
                      <p className="text-[9px] text-gray-400">Total paid <strong className="ml-1 text-sm text-white">₾{order.totalPrice ?? order.total ?? 0}</strong></p>
                      {ticketTab === 'upcoming' && <div>
                        <button type="button" onClick={() => handleRefund(order)} disabled={!order.isRefundable || refunding === String(getOrderReference(order))} title={refundDisabled ? 'Refunds are unavailable within 2 hours of the session.' : 'Refund order'} className="w-full rounded-full bg-[#292c3e] px-4 py-2 text-[9px] font-bold text-gray-200 transition hover:bg-[#35394d] disabled:cursor-not-allowed disabled:opacity-45">{refunding === String(getOrderReference(order)) ? 'Refunding...' : 'Refund'}</button>
                        {refundDisabled && <p className="mt-1 text-center text-[8px] text-gray-500">Refund unavailable within 2 hours</p>}
                      </div>}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : !ticketsError ? <p className="py-16 text-center text-xs text-gray-400">No {ticketTab} tickets.</p> : null}
        </section>
      )}
    </section>
  );
}