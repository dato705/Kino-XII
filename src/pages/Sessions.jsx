import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BookingModal from '../components/BookingModal';
import getSessionDates from '../utils/sessionDates';
import {
  createOrder,
  createSeatHold,
  getFilterOptions,
  getSessionSeats,
  getSessions,
  releaseHold,
} from '../api/cinema';

const FILTERS = [
  { key: 'venues[]', source: 'venues', label: 'Venues', multiple: true },
  { key: 'formats[]', source: 'formats', label: 'Formats', multiple: true },
  { key: 'languages[]', source: 'languages', label: 'Languages', multiple: true },
  { key: 'bands[]', source: 'timeBands', label: 'Time bands', multiple: true },
];
const MOVIES_PER_PAGE = 4;

const unwrap = (response) => response?.data?.data ?? response?.data ?? response;

const getRecords = (payload, key) => {
  const value = payload?.[key] ?? payload?.data ?? payload;
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[key])) return value[key];
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
};

const flattenSessionGroups = (payload) => getRecords(payload, 'sessions').flatMap((group) => {
  if (!Array.isArray(group.sessions)) return [group];
  return group.sessions.map((session) => ({ ...session, movie: session.movie || group.movie }));
});

const getOptions = (source, key) => {
  const values = source?.[key];
  if (Array.isArray(values)) {
    return values.map((option) => {
      if (typeof option !== 'object' || option === null) return { value: option, label: option };
        const value = option.slug ?? option.value ?? option.id ?? option.key ?? option.type ?? option.name;
        return { value, label: option.label ?? option.name ?? option.title ?? option.type ?? value };
    }).filter((option) => option.value !== undefined && option.value !== null);
  }
  if (values && typeof values === 'object') {
    return Object.entries(values).map(([value, label]) => ({
      value,
      label: typeof label === 'object' ? label.label ?? label.name ?? value : label,
    }));
  }
  return [];
};

const seatId = (seat) => String(seat.id);

const isSeatUnavailable = (seat) => {
  const status = String(seat.status ?? seat.state ?? '').toLowerCase();
  return seat.state === 'unavailable' || seat.available === false || seat.is_available === false ||
    ['sold', 'reserved', 'occupied', 'unavailable', 'contested'].includes(status) ||
    (status === 'held' && !seat.isMine);
};

const getSeatSections = (payload) => {
  const value = payload?.seatMap ?? payload?.data ?? payload;
  if (Array.isArray(value?.sections)) return value.sections;
  return [];
};

const getErrorMessage = (error, fallback) => {
  if (error.response?.status === 403) return 'This booking belongs to another account.';
  if (error.response?.status === 409) return 'Some selected seats were just taken. Please review the updated seat map.';
  if (error.response?.status === 422 && error.response.data?.message && !error.response.data?.errors) return error.response.data.message;
  if (error.response?.status === 422) return 'The selected details are invalid. Please check your selection.';
  return fallback;
};

const getAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
};

const formatSessionTime = (session) => {
  const value = session.startsAt || session.starts_at || session.start_time || session.datetime || session.date;
  if (!value) return 'Time TBA';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
};

export default function Sessions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { executeProtected, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [filterOptions, setFilterOptions] = useState(null);
  const [filtersError, setFiltersError] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [seats, setSeats] = useState([]);
  const [seatSections, setSeatSections] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [ticketTypes, setTicketTypes] = useState({});
  const [seatErrors, setSeatErrors] = useState([]);
  const [seatLoading, setSeatLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingStep, setBookingStep] = useState('seats');
  const [hold, setHold] = useState(null);
  const [order, setOrder] = useState(null);
  const [remainingHoldSeconds, setRemainingHoldSeconds] = useState(null);
  const [payment, setPayment] = useState({ fullName: '', email: '', mobileNumber: '', cardNumber: '', expiry: '', cvv: '' });
  const [paymentErrors, setPaymentErrors] = useState({});
  const queryString = searchParams.toString();
  const filterParams = new URLSearchParams(searchParams);
  filterParams.delete('page');
  filterParams.delete('session');
  const filtersQueryString = filterParams.toString();
  const queryStringRef = useRef(queryString);

  useEffect(() => {
    queryStringRef.current = queryString;
  }, [queryString]);

  useEffect(() => {
    getFilterOptions()
      .then((response) => setFilterOptions(unwrap(response)?.filter_options || unwrap(response)))
      .catch(() => setFiltersError('Filter options could not be loaded. Please try again later.'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const currentParams = new URLSearchParams(filtersQueryString);
    const params = {};
    for (const key of ['venues[]', 'formats[]', 'languages[]', 'bands[]']) {
      const values = currentParams.getAll(key);
      if (values.length) params[key.slice(0, -2)] = values;
    }
    for (const key of ['date', 'search', 'sort']) {
      const value = currentParams.get(key);
      if (value) params[key] = value;
    }
    getSessions(params)
      .then(async (response) => {
        if (!cancelled) {
          const payload = unwrap(response);
          const meta = response.data?.meta || response.data?.data?.meta || payload?.meta || null;
          const backendPages = Math.max(1, Number(meta?.lastPage || 1));
          const remainingResponses = await Promise.all(
            Array.from({ length: backendPages - 1 }, (_, index) => getSessions({ ...params, page: index + 2 }))
          );
          if (cancelled) return;
          const allSessions = [
            ...flattenSessionGroups(payload),
            ...remainingResponses.flatMap((pageResponse) => flattenSessionGroups(unwrap(pageResponse))),
          ];
          const uniqueSessions = [...new Map(allSessions.map((session, index) => [
            session.id ?? `${session.movie?.id ?? session.movie_id ?? session.movie?.title ?? session.movie_title ?? session.title ?? 'sessions'}-${session.startsAt ?? session.starts_at ?? session.start_time ?? index}`,
            session,
          ])).values()];
          setSessions(uniqueSessions);
          setSessionsError('');
          if (!currentParams.has('date') && meta?.date) {
            currentParams.set('date', meta.date);
            const displayPage = new URLSearchParams(queryStringRef.current).get('page');
            if (displayPage) currentParams.set('page', displayPage);
            setLoading(true);
            setSearchParams(currentParams, { replace: true });
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSessionsError(getErrorMessage(error, 'Sessions could not be loaded. Please try again later.'));
          setSessions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filtersQueryString, setSearchParams]);

  const updateFilter = (key, value) => {
    const nextParams = new URLSearchParams(searchParams);
    if (key.endsWith('[]')) {
      nextParams.delete(key);
      value.forEach((entry) => nextParams.append(key, entry));
    } else if (value) nextParams.set(key, value);
    else nextParams.delete(key);
    if (key !== 'page') {
      nextParams.set('page', '1');
      setLoading(true);
      setSessionsError('');
    }
    setSearchParams(nextParams);
  };

  const fetchSeats = useCallback(async (session, preserveSelection = []) => {
    setSeatLoading(true);
    setBookingError('');
    try {
      const response = await getSessionSeats(session.id);
      const nextSections = getSeatSections(unwrap(response));
      const nextSeats = nextSections.flatMap((section) =>
        (section.rows || []).flatMap((row) => row.seats || [])
      );
      setSeatSections(nextSections);
      setSeats(nextSeats);
      setSeatErrors([]);
      const retained = preserveSelection.filter((selectedId) =>
        nextSeats.some((seat) => seatId(seat) === selectedId && !isSeatUnavailable(seat))
      );
      const mine = nextSeats.filter((seat) => seat.isMine).map(seatId);
      setSelectedSeats([...new Set([...mine, ...retained])]);
      setTicketTypes((current) => ({
        ...current,
        ...Object.fromEntries(nextSeats.filter((seat) => seat.isMine).map((seat) => [
          seatId(seat), seat.ticketType || 'adult',
        ])),
      }));
    } catch (error) {
      setBookingError(getErrorMessage(error, 'Seats could not be loaded. Please try again.'));
    } finally {
      setSeatLoading(false);
    }
  }, []);

  const openBooking = useCallback((session, authenticatedUser) => {
    if (!authenticatedUser?.profileComplete) {
      navigate('/profile', { state: { from: location.pathname + location.search } });
      return;
    }
    setActiveSession(session);
    setSeats([]);
    setSeatSections([]);
    setSelectedSeats([]);
    setSeatErrors([]);
    setTicketTypes({});
    setHold(null);
    setOrder(null);
    setRemainingHoldSeconds(null);
    setBookingStep('seats');
    setPayment({
      fullName: authenticatedUser?.fullName || '',
      email: authenticatedUser?.email || '',
      mobileNumber: authenticatedUser?.mobileNumber || '',
      cardNumber: '',
      expiry: '',
      cvv: '',
    });
    fetchSeats(session);
  }, [fetchSeats, location.pathname, location.search, navigate]);

  const requestedSessionId = searchParams.get('session');
  useEffect(() => {
    if (!requestedSessionId || loading) return;
    const targetSession = sessions.find((session) => String(session.id) === requestedSessionId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('session');
    setSearchParams(nextParams, { replace: true });
    if (targetSession) executeProtected((authenticatedUser) => openBooking(targetSession, authenticatedUser));
  }, [requestedSessionId, sessions, loading, searchParams, setSearchParams, executeProtected, openBooking]);

  const toggleSeat = (seat) => {
    const id = seatId(seat);
    if (isSeatUnavailable(seat) || hold) return;
    setSeatErrors((current) => current.filter((errorId) => errorId !== id));
    setSelectedSeats((current) => {
      if (current.includes(id)) return current.filter((selectedId) => selectedId !== id);
      const seatCap = Number(filterOptions?.maxSeatsPerOrder);
      if (Number.isFinite(seatCap) && seatCap > 0 && current.length >= seatCap) {
        setBookingError(`You can select up to ${seatCap} seats per order.`);
        return current;
      }
      setBookingError('');
      setTicketTypes((types) => ({ ...types, [id]: types[id] || 'adult' }));
      return [...current, id];
    });
  };

  const holdSelectedSeats = async () => {
    if (!activeSession || selectedSeats.length === 0 || !bookingAgeAllowed) return false;
    setBookingLoading(true);
    setBookingError('');
    setSeatErrors([]);
    try {
      const response = await createSeatHold(activeSession.id, selectedSeats.map((id) => {
        const seat = seats.find((item) => seatId(item) === id);
        return { seatId: seat.id, ticketType: ticketTypes[id] || 'adult' };
      }));
      const payload = unwrap(response);
      const holdData = payload?.hold ?? payload;
      const holdId = holdData?.id ?? holdData?.holdId;
      if (!holdId) throw new Error('The API did not return a hold ID.');
      setHold({ ...holdData, id: holdId });
      setBookingStep('checkout');
      return true;
    } catch (error) {
      if (error.response?.status === 409) {
        const contested = error.response.data?.contested ?? error.response.data?.seats ?? [];
        const contestedCodes = contested.map((seat) => typeof seat === 'object' ? seat.code : seat).filter(Boolean);
        const contestedKeys = new Set(contested.map((seat) => String(typeof seat === 'object' ? seat.code : seat)));
        const lostSeats = seats.filter((seat) => contestedKeys.has(String(seat.code)) || contestedKeys.has(seatId(seat)));
        const contestedIds = new Set(lostSeats.map(seatId));
        setSeats((current) => current.map((seat) => contestedIds.has(seatId(seat))
          ? { ...seat, state: 'sold' }
          : seat
        ));
        const remaining = selectedSeats.filter((id) => !contestedIds.has(id));
        setSelectedSeats(remaining);
        await fetchSeats(activeSession, remaining);
        setBookingError(contestedCodes.length
          ? `Seats ${contestedCodes.join(', ')} were just taken. Your other selections remain selected.`
          : getErrorMessage(error, 'Some seats were just taken. Your other selections remain selected.'));
      } else {
        if (error.response?.status === 422) {
          const fieldErrors = error.response.data?.errors || {};
          const invalidSeatIds = Object.keys(fieldErrors).flatMap((field) => {
            const match = field.match(/(?:seat_ids|seats)(?:\.(\d+))?/);
            if (!match) return [];
            return match[1] === undefined
              ? selectedSeats
              : [selectedSeats[Number(match[1])]].filter(Boolean);
          });
          setSeatErrors([...new Set(invalidSeatIds)]);
          if (!Object.keys(fieldErrors).length && /profile/i.test(error.response.data?.message || '')) {
            navigate('/profile', { state: { from: location.pathname + location.search } });
          }
        }
        setBookingError(getErrorMessage(error, 'Could not hold the selected seats. Please try again.'));
      }
      return false;
    } finally {
      setBookingLoading(false);
    }
  };

  const confirmOrder = async (event) => {
    event.preventDefault();
    if (!hold?.id) return;
    setBookingLoading(true);
    setPaymentErrors({});
    try {
      const response = await createOrder({
        ...payment,
        cardNumber: payment.cardNumber.replace(/\s/g, ''),
        holdId: hold.id,
      });
      setOrder(unwrap(response)?.order ?? unwrap(response));
      setHold(null);
    } catch (error) {
      const fieldErrors = error.response?.data?.errors;
      if (fieldErrors) {
        setPaymentErrors(fieldErrors);
      } else if (error.response?.status === 422 && /hold time expired/i.test(error.response.data?.message || '')) {
        const holdId = hold.id;
        setHold(null);
        setRemainingHoldSeconds(null);
        setSelectedSeats([]);
        await releaseHold(holdId).catch(() => {});
        await fetchSeats(activeSession);
        setBookingError(error.response.data.message);
      } else if (error.response?.status === 409) {
        const contested = error.response.data?.contested ?? [];
        const contestedCodes = contested.map((seat) => typeof seat === 'object' ? seat.code : seat).filter(Boolean);
        const contestedIds = new Set(seats
          .filter((seat) => contestedCodes.includes(seat.code))
          .map(seatId));
        const remaining = selectedSeats.filter((id) => !contestedIds.has(id));
        setHold(null);
        setSelectedSeats(remaining);
        await fetchSeats(activeSession, remaining);
        setBookingError(contestedCodes.length
          ? `Seats ${contestedCodes.join(', ')} were sold. Please review the updated seat map.`
          : getErrorMessage(error, 'Some selected seats were sold. Please review the updated seat map.'));
      } else {
        setBookingError(getErrorMessage(error, 'Your order could not be completed. Please try again.'));
      }
    } finally {
      setBookingLoading(false);
    }
  };

  const closeBooking = () => {
    if (hold?.id) releaseHold(hold.id).catch(() => {});
    setActiveSession(null);
    setHold(null);
    setRemainingHoldSeconds(null);
    setOrder(null);
    setSeatErrors([]);
    setSelectedSeats([]);
    setTicketTypes({});
    setBookingError('');
    setBookingStep('seats');
  };

  const returnToSeatSelection = async () => {
    if (!activeSession) return;
    if (hold?.id) await releaseHold(hold.id).catch(() => {});
    setHold(null);
    setRemainingHoldSeconds(null);
    setBookingStep('seats');
    await fetchSeats(activeSession, selectedSeats);
  };

  const sessionTitle = (session) => session.movie?.title || session.movie_title || session.title || 'Cinema session';
  const sessionVenue = (session) => session.venue?.name || session.venueName || session.cinema?.name || session.venue_name || session.venue || '';
  const seatCap = Number(filterOptions?.maxSeatsPerOrder);
  const venueOptions = getOptions(filterOptions, 'venues').map((option) => {
    const venue = (filterOptions?.venues || []).find((entry) => entry.slug === option.value);
    return venue?.city ? { ...option, label: `${option.label} · ${venue.city}` } : option;
  });
  const formatOptions = getOptions(filterOptions, 'formats');
  const selectedVenueSlugs = searchParams.getAll('venues[]');
  const selectedVenueData = (filterOptions?.venues || []).filter((venue) => selectedVenueSlugs.includes(venue.slug));
  const allowedFormats = selectedVenueData.length
    ? formatOptions.filter((format) => selectedVenueData.some((venue) =>
      (venue.formats || []).some((entry) => (entry.slug ?? entry) === format.value)
    ))
    : formatOptions;
  const ticketTypeOptions = getOptions(filterOptions, 'ticketTypes').map((option) => {
    const ticketType = (filterOptions?.ticketTypes || []).find((type) => type.slug === option.value);
    return { ...ticketType, ...option };
  });
  const minAge = Number(activeSession?.movie?.ageRating?.minAge ?? activeSession?.movie?.age_rating?.min_age ?? 0);
  const userAge = getAge(user?.dateOfBirth || user?.date_of_birth);
  const bookingAgeAllowed = !activeSession || minAge === 0 || (userAge !== null && userAge >= minAge);
  const ageMessage = activeSession && !bookingAgeAllowed
    ? userAge === null
      ? 'Your age could not be verified from your profile.'
      : `This film is rated ${activeSession.movie?.ageRating?.code || activeSession.movie?.age_rating?.code || `${minAge}+`}. You cannot buy tickets for it with this account.`
    : '';
  const visibleTicketTypes = ticketTypeOptions.filter((option) => {
    return option.blockedFromRatingAge == null || minAge < option.blockedFromRatingAge;
  });
  const currentPage = Number(searchParams.get('page') || 1);
  const weekDates = getSessionDates();
  const activeFilterCount = FILTERS.reduce((count, { key }) => count + searchParams.getAll(key).length, 0) +
    Number(Boolean(searchParams.get('search'))) + Number(Boolean(searchParams.get('sort')));
  const renderFilter = ({ key, source, label }) => {
    const options = source === 'venues' ? venueOptions : source === 'formats' ? allowedFormats : getOptions(filterOptions, source);
    const selected = searchParams.getAll(key);
    return (
      <fieldset key={key} className="border-t border-white/5 py-3">
        <legend className="mb-2 text-[9px] font-medium uppercase text-gray-400">{label}</legend>
        <div className="space-y-1.5">
          {options.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 text-[11px] leading-4 text-gray-200">
              <input
                type="checkbox"
                checked={selected.includes(String(option.value))}
                onChange={(event) => updateFilter(key, event.target.checked
                  ? [...selected, String(option.value)]
                  : selected.filter((value) => value !== String(option.value))
                )}
                className="h-3 w-3 shrink-0 accent-red-500"
              />
              <span className="truncate">{option.label}</span>
            </label>
          ))}
          {!options.length && <p className="text-[10px] text-gray-500">No options available</p>}
        </div>
      </fieldset>
    );
  };
  const groupedSessions = sessions.reduce((groups, session) => {
    const movie = session.movie || {};
    const key = movie.id ?? session.movie_id ?? session.movieId ?? movie.title ?? session.movie_title ?? session.title ?? 'sessions';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(session);
    return groups;
  }, new Map());
  const lastPage = Math.max(1, Math.ceil(groupedSessions.size / MOVIES_PER_PAGE));
  const pageItems = lastPage <= 5
    ? Array.from({ length: lastPage }, (_, index) => index + 1)
    : currentPage <= 3
      ? [1, 2, 3, 'ellipsis', lastPage]
      : currentPage >= lastPage - 2
        ? [1, 'ellipsis', lastPage - 2, lastPage - 1, lastPage]
        : [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', lastPage];
  const visibleMovieGroups = [...groupedSessions.entries()].slice(
    (currentPage - 1) * MOVIES_PER_PAGE,
    currentPage * MOVIES_PER_PAGE
  );

  useEffect(() => {
    if (!hold?.expiresAt || !activeSession) return undefined;
    let expired = false;
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((new Date(hold.expiresAt).getTime() - Date.now()) / 1000));
      setRemainingHoldSeconds(remaining);
      if (remaining === 0 && !expired) {
        expired = true;
        releaseHold(hold.id).catch(() => {});
        setHold(null);
        setSelectedSeats([]);
        setRemainingHoldSeconds(null);
        setBookingStep('seats');
        fetchSeats(activeSession).then(() => {
          setBookingError('Your hold time expired. Please re-select your seats.');
        });
      }
    };
    const timer = window.setInterval(updateCountdown, 1000);
    window.setTimeout(updateCountdown, 0);
    return () => window.clearInterval(timer);
  }, [hold?.id, hold?.expiresAt, activeSession, fetchSeats]);

  return (
    <div className="pb-16">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Sessions</h1>
        <p className="mt-1 text-xs text-gray-400">Browse showtimes across all venues</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(170px,210px)_minmax(0,1fr)]">
        <aside className="rounded-lg bg-[#1b1d32] p-4 text-white">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Filters</h2>
          </div>

          {FILTERS.slice(0, 1).map(renderFilter)}

          <fieldset className="border-t border-white/5 py-3">
            <legend className="mb-2 text-[9px] font-medium uppercase text-gray-400">Date</legend>
            <div className="grid grid-cols-4 gap-1.5">
              {weekDates.map((date) => (
                <button
                  key={date.value}
                  type="button"
                  aria-pressed={searchParams.get('date') === date.value}
                  onClick={() => updateFilter('date', date.value)}
                  className={`rounded px-1 py-1.5 text-center text-[9px] transition ${searchParams.get('date') === date.value ? 'bg-red-500 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
                >
                  <span className="block">{date.weekday}</span>
                  <span className="block font-semibold">{date.day}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {FILTERS.slice(1).map(renderFilter)}

          {filtersError && <p role="alert" className="border-t border-white/5 pt-3 text-[11px] text-red-400">{filtersError}</p>}
          <button
            type="button"
            onClick={() => {
              const retainedParams = new URLSearchParams();
              const selectedDate = searchParams.get('date');
              if (selectedDate) retainedParams.set('date', selectedDate);
              setLoading(true);
              setSessionsError('');
              setSearchParams(retainedParams);
            }}
            disabled={!queryString}
            className="w-full rounded-full border border-gray-500 px-3 py-1.5 text-[10px] font-semibold text-gray-200 transition hover:border-gray-300 hover:text-white disabled:opacity-40"
          >
            Clear filters
          </button>
          <p className="border-t border-white/5 pt-3 text-center text-[9px] text-gray-500">
            {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'} active
          </p>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-4 text-[10px] text-gray-300">
            {!loading && <p>{sessions.length ? `Showing ${sessions.length} sessions` : 'No sessions found'}</p>}
            <label className="flex items-center gap-1.5 whitespace-nowrap text-gray-400">
              Sort:
              <select
                value={searchParams.get('sort') || ''}
                onChange={(event) => updateFilter('sort', event.target.value)}
                className="max-w-40 bg-transparent font-semibold text-white outline-none"
              >
                <option value="">Showtime: earliest first</option>
                {getOptions(filterOptions, 'sorts').map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#111426]">{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          {sessionsError && <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{sessionsError}</p>}
          {loading ? <p className="py-12 text-center text-sm text-gray-400">Loading sessions...</p> : groupedSessions.size ? (
            <div className="divide-y divide-white/10">
              {visibleMovieGroups.map(([movieKey, movieSessions]) => {
                const firstSession = movieSessions[0];
                const movie = firstSession.movie || {};
                const poster = movie.posterUrl || movie.poster_url || firstSession.poster_url || movie.cover;
                const runtime = movie.runtimeMinutes || movie.runtime_minutes || movie.duration || firstSession.runtimeMinutes;
                const ageRating = movie.ageRating?.code || movie.age_rating?.code || movie.age_limit || '';
                return (
                  <article key={movieKey} className="min-w-0 py-4">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-10 w-7 shrink-0 overflow-hidden rounded bg-[#1a2030]">
                        {poster && <img src={poster} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-xs font-bold text-white">{sessionTitle(firstSession)}</h2>
                          {ageRating && <span className="rounded bg-red-500/15 px-1 py-0.5 text-[8px] font-bold text-red-400">{ageRating}</span>}
                        </div>
                        <p className="text-[9px] text-gray-500">{runtime ? `${runtime} min` : 'Movie'} · {movieSessions.length} showtimes</p>
                      </div>
                    </div>

                    <div className="flex snap-x gap-2 overflow-x-auto pb-1">
                      {movieSessions.map((session, index) => {
                        const id = session.id;
                        const price = session.price ?? session.ticketPrice ?? session.ticket_price ?? movie.price;
                        const seatsLeft = session.seatsLeft ?? session.seats_left ?? session.availableSeats ?? session.available_seats ?? session.remainingSeats ?? session.remaining_seats;
                        const soldOut = session.isSoldOut || session.is_sold_out || Number(seatsLeft) === 0;
                        const unavailable = !id || soldOut;
                        const format = session.format?.name || session.format?.label || session.format;
                        const language = session.language?.name || session.language?.label || session.language;
                        const venue = sessionVenue(session);
                        const room = session.hall?.name || session.auditorium?.name || session.room?.name || session.hall_name || session.room_name;
                        return (
                          <button
                            key={id ?? index}
                            type="button"
                            onClick={() => executeProtected((authenticatedUser) => openBooking(session, authenticatedUser))}
                            disabled={unavailable}
                            className={`group/session w-[132px] shrink-0 snap-start rounded-lg border border-white/5 bg-[#1b1d32] p-2 text-left transition ${unavailable ? 'cursor-not-allowed opacity-40' : 'hover:border-red-500/50 hover:bg-[#22243a]'}`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-bold text-gray-100">{formatSessionTime(session)}</span>
                              {format && <span className="max-w-16 truncate rounded bg-white/10 px-1 py-0.5 text-[7px] font-semibold uppercase text-gray-300">{format}</span>}
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-1 text-[8px]">
                              <p className="min-w-0 truncate text-gray-500">{language || 'Original'}{language ? ' · Subtitles' : ' + Subtitles'}</p>
                              {seatsLeft !== undefined && seatsLeft !== null && (
                                <span className={`flex shrink-0 items-center gap-1 font-medium ${Number(seatsLeft) <= 5 ? 'text-red-500' : 'text-emerald-400'}`}>
                                  <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                    <path d="M2.5 3.25A1.25 1.25 0 0 1 3.75 2h8.5a1.25 1.25 0 0 1 1.25 1.25v2.1a1.65 1.65 0 0 0 0 3.3v2.1A1.25 1.25 0 0 1 12.25 12h-8.5A1.25 1.25 0 0 1 2.5 10.75v-2.1a1.65 1.65 0 0 0 0-3.3v-2.1Zm5.5.5a.65.65 0 0 0-.65.65v.55a.65.65 0 1 0 1.3 0V4.4A.65.65 0 0 0 8 3.75Zm0 3.15a.65.65 0 0 0-.65.65v.55a.65.65 0 1 0 1.3 0v-.55A.65.65 0 0 0 8 6.9Z" />
                                  </svg>
                                  {seatsLeft} left
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 flex items-center justify-between gap-1 text-[8px]">
                              <span className="min-w-0 truncate text-gray-300">{venue}{room ? ` · ${room}` : ''}</span>
                              {soldOut ? <span className="shrink-0 text-gray-500">Sold out</span> : (
                                <span className="shrink-0 font-bold text-white">{price !== undefined ? `₾${price}` : seatsLeft !== undefined ? `${seatsLeft} left` : ''}</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : !sessionsError ? <p className="py-12 text-center text-sm text-gray-400">No sessions found</p> : null}
        </section>
      </div>

      {!loading && lastPage > 1 && (
        <nav aria-label="Session pages" className="flex items-center justify-center gap-2 pt-5">
          <button
            type="button"
            onClick={() => updateFilter('page', String(Math.max(1, currentPage - 1)))}
            disabled={currentPage <= 1}
            aria-label="Previous page"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1b1d32] text-gray-300 transition hover:bg-[#252840] disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="m12 4-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
            </svg>
          </button>
          {pageItems.map((page, index) => page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="flex h-10 w-8 items-center justify-center text-xs text-gray-400">...</span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => updateFilter('page', String(page))}
              aria-current={currentPage === page ? 'page' : undefined}
              className={`flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-xs transition ${currentPage === page ? 'bg-red-500 font-semibold text-white' : 'text-gray-300 hover:bg-[#1b1d32]'}`}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            onClick={() => updateFilter('page', String(Math.min(lastPage, currentPage + 1)))}
            disabled={currentPage >= lastPage}
            aria-label="Next page"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1b1d32] text-gray-300 transition hover:bg-[#252840] disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="m8 4 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
            </svg>
          </button>
        </nav>
      )}

      {activeSession && (
        <BookingModal
          session={activeSession}
          seatSections={seatSections}
          seats={seats}
          selectedSeats={selectedSeats}
          ticketTypes={ticketTypes}
          seatErrors={seatErrors}
          seatLoading={seatLoading}
          bookingLoading={bookingLoading}
          bookingError={bookingError}
          hold={hold}
          order={order}
          remainingHoldSeconds={remainingHoldSeconds}
          seatCap={seatCap}
          ticketTypeOptions={visibleTicketTypes}
          payment={payment}
          paymentErrors={paymentErrors}
          ageAllowed={bookingAgeAllowed}
          ageMessage={ageMessage}
          step={bookingStep}
          onClose={closeBooking}
          onToggleSeat={toggleSeat}
          onTicketTypeChange={(id, type) => setTicketTypes((current) => ({ ...current, [id]: type }))}
          onPaymentChange={(key, value) => setPayment((current) => ({ ...current, [key]: value }))}
          onHoldSeats={holdSelectedSeats}
          onConfirmOrder={confirmOrder}
          onBackToSeats={returnToSeatSelection}
          onViewTickets={() => {
            closeBooking();
            navigate('/profile');
          }}
        />
      )}
    </div>
  );
}