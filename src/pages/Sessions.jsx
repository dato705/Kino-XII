import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  { key: 'sort', source: 'sorts', label: 'Sort' },
];

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

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export default function Sessions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { executeProtected } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [filterOptions, setFilterOptions] = useState(null);
  const [filtersError, setFiltersError] = useState('');
  const [sessions, setSessions] = useState([]);
  const [pagination, setPagination] = useState(null);
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
  const [hold, setHold] = useState(null);
  const [order, setOrder] = useState(null);
  const [remainingHoldSeconds, setRemainingHoldSeconds] = useState(null);
  const [payment, setPayment] = useState({ fullName: '', email: '', mobileNumber: '', cardNumber: '', expiry: '', cvv: '' });
  const [paymentErrors, setPaymentErrors] = useState({});
  const queryString = searchParams.toString();

  useEffect(() => {
    getFilterOptions()
      .then((response) => setFilterOptions(unwrap(response)?.filter_options || unwrap(response)))
      .catch(() => setFiltersError('Filter options could not be loaded. Please try again later.'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const currentParams = new URLSearchParams(queryString);
    const params = {};
    for (const key of ['venues[]', 'formats[]', 'languages[]', 'bands[]']) {
      const values = currentParams.getAll(key);
      if (values.length) params[key.slice(0, -2)] = values;
    }
    for (const key of ['date', 'search', 'sort', 'page']) {
      const value = currentParams.get(key);
      if (value) params[key] = value;
    }
    getSessions(params)
      .then((response) => {
        if (!cancelled) {
          const payload = unwrap(response);
          const meta = response.data?.meta || response.data?.data?.meta || payload?.meta || null;
          setSessions(flattenSessionGroups(payload));
          setPagination(meta);
          setSessionsError('');
          if (!currentParams.has('date') && meta?.date) {
            currentParams.set('date', meta.date);
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
  }, [queryString, setSearchParams]);

  const updateFilter = (key, value) => {
    const nextParams = new URLSearchParams(searchParams);
    if (key.endsWith('[]')) {
      nextParams.delete(key);
      value.forEach((entry) => nextParams.append(key, entry));
    } else if (value) nextParams.set(key, value);
    else nextParams.delete(key);
    if (key !== 'page') nextParams.set('page', '1');
    setLoading(true);
    setSessionsError('');
    setSearchParams(nextParams);
  };

  const fetchSeats = async (session, preserveSelection = []) => {
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
  };

  const openBooking = (session, authenticatedUser) => {
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
    setPayment({
      fullName: authenticatedUser?.fullName || '',
      email: authenticatedUser?.email || '',
      mobileNumber: authenticatedUser?.mobileNumber || '',
      cardNumber: '',
      expiry: '',
      cvv: '',
    });
    fetchSeats(session);
  };

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
    if (!activeSession || selectedSeats.length === 0) return;
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
      const response = await createOrder({ ...payment, holdId: hold.id });
      setOrder(unwrap(response)?.order ?? unwrap(response));
      setHold(null);
      setSelectedSeats([]);
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
    setBookingError('');
  };

  const sessionTitle = (session) => session.movie?.title || session.movie_title || session.title || 'Cinema session';
  const sessionVenue = (session) => session.venue?.name || session.venueName || session.cinema?.name || session.venue_name || session.venue || '';
  const sessionTime = (session) => formatDateTime(session.startsAt || session.starts_at || session.start_time || session.datetime || session.date);
  const seatCap = Number(filterOptions?.maxSeatsPerOrder);
  const holdMinutes = filterOptions?.holdMinutes;
  const venueOptions = getOptions(filterOptions, 'venues');
  const formatOptions = getOptions(filterOptions, 'formats');
  const selectedVenueSlugs = searchParams.getAll('venues[]');
  const selectedVenueData = (filterOptions?.venues || []).filter((venue) => selectedVenueSlugs.includes(venue.slug));
  const allowedFormats = selectedVenueData.length
    ? formatOptions.filter((format) => selectedVenueData.some((venue) =>
      (venue.formats || []).some((entry) => (entry.slug ?? entry) === format.value)
    ))
    : formatOptions;
  const ticketTypeOptions = getOptions(filterOptions, 'ticketTypes');
  const minAge = Number(activeSession?.movie?.ageRating?.minAge ?? activeSession?.movie?.age_rating?.min_age ?? 0);
  const visibleTicketTypes = ticketTypeOptions.filter((option) => {
    const ticketType = (filterOptions?.ticketTypes || []).find((item) => item.slug === option.value);
    return ticketType?.blockedFromRatingAge == null || minAge < ticketType.blockedFromRatingAge;
  });
  const currentPage = Number(searchParams.get('page') || 1);
  const lastPage = Number(pagination?.lastPage || 1);

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
        fetchSeats(activeSession).then(() => {
          setBookingError('Your hold time expired. Please re-select your seats.');
        });
      }
    };
    const timer = window.setInterval(updateCountdown, 1000);
    window.setTimeout(updateCountdown, 0);
    return () => window.clearInterval(timer);
  }, [hold?.id, hold?.expiresAt, activeSession]);

  return (
    <div className="space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wider text-white">Sessions & Schedule</h1>
        <p className="mt-1 text-sm text-gray-400">Choose a session to view available seats.</p>
      </div>

      <section className="space-y-3 border-y border-gray-800 py-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FILTERS.map(({ key, source, label, multiple }) => {
            const options = source === 'venues' ? venueOptions : source === 'formats' ? allowedFormats : getOptions(filterOptions, source);
            return (
              <label key={key} className="space-y-1 text-xs font-semibold text-gray-400">
                <span>{label}</span>
                <select
                  multiple={multiple}
                  value={multiple ? searchParams.getAll(key) : searchParams.get(key) || ''}
                  onChange={(event) => updateFilter(key, multiple
                    ? [...event.target.selectedOptions].map((option) => option.value)
                    : event.target.value
                  )}
                  disabled={!options.length}
                  className={`w-full rounded-lg border border-gray-800 bg-[#161B26] px-3 py-2.5 text-sm text-white disabled:opacity-50 ${multiple ? 'min-h-24' : ''}`}
                >
                  {!multiple && <option value="">Default {label.toLowerCase()}</option>}
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            );
          })}
          <label className="space-y-1 text-xs font-semibold text-gray-400">
            <span>Date</span>
            <input type="date" value={searchParams.get('date') || ''} onChange={(event) => updateFilter('date', event.target.value)} className="w-full rounded-lg border border-gray-800 bg-[#161B26] px-3 py-2.5 text-sm text-white" />
          </label>
          <label className="space-y-1 text-xs font-semibold text-gray-400">
            <span>Search films</span>
            <input type="search" value={searchParams.get('search') || ''} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Film title" className="w-full rounded-lg border border-gray-800 bg-[#161B26] px-3 py-2.5 text-sm text-white placeholder:text-gray-500" />
          </label>
        </div>
        <div className="flex items-center justify-between gap-4">
          {filtersError && <p role="alert" className="text-sm text-red-400">{filtersError}</p>}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setSessionsError('');
              setSearchParams({});
            }}
            disabled={!queryString}
            className="ml-auto text-xs font-semibold text-gray-400 transition hover:text-white disabled:opacity-40"
          >
            Clear filters
          </button>
        </div>
      </section>

      {sessionsError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{sessionsError}</p>}
      {pagination?.totalSessions !== undefined && <p className="text-sm text-gray-400">Showing {pagination.totalSessions} sessions across {pagination.totalMovies} movies</p>}
      {loading ? <p className="py-12 text-center text-gray-400">Loading sessions...</p> : sessions.length ? (
        <div className="divide-y divide-gray-800">
          {sessions.map((session, index) => {
            const id = session.id;
            const poster = session.movie?.posterUrl || session.movie?.poster_url || session.poster_url || session.movie?.cover;
            const price = session.price ?? session.ticketPrice ?? session.ticket_price ?? session.movie?.price;
            const soldOut = session.isSoldOut;
            return (
              <article key={id ?? index} className="flex flex-wrap items-center gap-4 py-5">
                <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-[#1A202C]">
                  {poster && <img src={poster} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-bold text-white">{sessionTitle(session)}</h2>
                  <p className="mt-1 text-sm text-gray-400">{sessionVenue(session)}</p>
                  <p className="mt-1 text-sm text-gray-300">{sessionTime(session)}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {[session.format?.name || session.format, session.language?.name || session.language, session.movie?.ageRating?.label].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {price !== undefined && <span className="text-sm font-bold text-white">₾ {price}</span>}
                  {session.seatsLeft !== undefined && <span className="text-xs text-gray-400">{session.seatsLeft} seats</span>}
                  <button
                    type="button"
                    onClick={() => executeProtected((authenticatedUser) => openBooking(session, authenticatedUser))}
                    disabled={!id || soldOut}
                    className="rounded-lg bg-red-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-40"
                  >
                    {soldOut ? 'Sold out' : 'Choose seats'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : !sessionsError ? <p className="py-12 text-center text-gray-400">No sessions match these filters.</p> : null}

      {!loading && lastPage > 1 && (
        <nav aria-label="Session pages" className="flex items-center justify-center gap-4 border-t border-gray-800 pt-5">
          <button type="button" onClick={() => updateFilter('page', String(Math.max(1, currentPage - 1)))} disabled={currentPage <= 1} className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-white disabled:opacity-40">Previous</button>
          <span className="text-sm text-gray-400">Page {currentPage} of {lastPage}</span>
          <button type="button" onClick={() => updateFilter('page', String(Math.min(lastPage, currentPage + 1)))} disabled={currentPage >= lastPage} className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-white disabled:opacity-40">Next</button>
        </nav>
      )}

      {activeSession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" onClick={closeBooking}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-800 bg-[#0B0E17] p-5 text-white sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="booking-title" className="text-xl font-bold">{sessionTitle(activeSession)}</h2>
                <p className="mt-1 text-sm text-gray-400">{sessionVenue(activeSession)} · {sessionTime(activeSession)}</p>
              </div>
              <button type="button" onClick={closeBooking} aria-label="Close seat selection" className="text-xl text-gray-400 hover:text-white">×</button>
            </div>

            {seatLoading ? <p className="py-12 text-center text-gray-400">Loading seats...</p> : (
              <div className="mt-6">
                <div className="mb-6 rounded bg-gray-700 py-1 text-center text-xs font-bold uppercase text-gray-300">Screen</div>
                <div className="space-y-7">
                  {seatSections.map((section) => (
                    <section key={section.id || section.name} className="space-y-3">
                      <h3 className="text-center text-xs font-bold uppercase tracking-wider text-gray-400">{section.name}</h3>
                      <div className="space-y-2">
                        {(section.rows || []).map((row) => (
                          <div key={row.id || row.label || row.name} className="flex items-center justify-center gap-2">
                            <span className="w-6 text-right text-xs text-gray-500">{row.label || row.name}</span>
                            <div className="flex items-center gap-1.5">
                              {(row.seats || []).map((seat) => {
                                const id = seatId(seat);
                                const unavailable = isSeatUnavailable(seat);
                                const selected = selectedSeats.includes(id);
                                if (seat.state === 'unavailable') return <span key={id} className="h-9 w-8" aria-hidden="true" />;
                                return (
                                  <span key={id} className="flex items-center">
                                    <button
                                      type="button"
                                      onClick={() => toggleSeat(seat)}
                                      disabled={unavailable || Boolean(hold)}
                                      aria-pressed={selected}
                                      aria-invalid={seatErrors.includes(id)}
                                      aria-label={`Seat ${seat.code}`}
                                      title={`${seat.code}${seat.isMine ? ' · Yours' : ''}`}
                                      className={`h-9 min-w-9 rounded-t-lg px-2 text-xs font-bold transition ${
                                        unavailable ? 'cursor-not-allowed bg-gray-800 text-gray-600' :
                                          seatErrors.includes(id) ? 'bg-red-900 text-red-200 ring-2 ring-red-500' :
                                            selected || seat.isMine ? 'bg-red-500 text-white' : 'bg-emerald-700/70 text-emerald-100 hover:bg-emerald-600'
                                      }`}
                                    >
                                      {seat.label}
                                    </button>
                                    {seat.aisleAfter && <span className="w-4" aria-hidden="true" />}
                                  </span>
                                );
                              })}
                            </div>
                            <span className="w-6 text-xs text-gray-500">{row.label || row.name}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
                  <span>{selectedSeats.length} selected{Number.isFinite(seatCap) && seatCap > 0 ? ` · max ${seatCap}` : ''}</span>
                  {holdMinutes && !hold && <span>Seats stay held for {holdMinutes} minutes.</span>}
                </div>
                {selectedSeats.length > 0 && !hold && (
                  <div className="mt-5 space-y-2 border-t border-gray-800 pt-4">
                    {selectedSeats.map((id) => {
                      const seat = seats.find((item) => seatId(item) === id);
                      return (
                        <label key={id} className="flex items-center justify-between gap-4 text-sm">
                          <span>{seat?.code || `Seat ${seat?.label}`}</span>
                          <select value={ticketTypes[id] || 'adult'} onChange={(event) => setTicketTypes((types) => ({ ...types, [id]: event.target.value }))} className="rounded-lg border border-gray-700 bg-[#161B26] px-3 py-2 text-white">
                            {visibleTicketTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {bookingError && <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{bookingError}</p>}
            {order && (
              <div role="status" className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
                <p className="font-bold">Order confirmed</p>
                <p className="mt-1 text-sm">Reference: {order.reference}</p>
              </div>
            )}
            {hold && !order && (
              <>
                <p role="status" className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">
                  Seats are held{remainingHoldSeconds !== null ? ` · ${Math.floor(remainingHoldSeconds / 60)}:${String(remainingHoldSeconds % 60).padStart(2, '0')} remaining` : ''}.
                </p>
                <form onSubmit={confirmOrder} className="mt-5 space-y-4 border-t border-gray-800 pt-5">
                  <h3 className="font-bold">Payment details</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ['fullName', 'Full name', 'text'],
                      ['email', 'Email', 'email'],
                      ['mobileNumber', 'Mobile number', 'tel'],
                      ['cardNumber', 'Card number', 'text'],
                      ['expiry', 'Expiry date (MM/YY)', 'text'],
                      ['cvv', 'CVV', 'password'],
                    ].map(([key, label, type]) => (
                      <label key={key} className="space-y-1 text-xs font-semibold text-gray-400">
                        <span>{label}</span>
                        <input
                          type={type}
                          value={payment[key]}
                          onChange={(event) => setPayment((current) => ({ ...current, [key]: event.target.value }))}
                          autoComplete={key === 'fullName' ? 'name' : key === 'email' ? 'email' : key === 'mobileNumber' ? 'tel' : key === 'cardNumber' ? 'cc-number' : key === 'expiry' ? 'cc-exp' : 'cc-csc'}
                          inputMode={['mobileNumber', 'cardNumber', 'cvv'].includes(key) ? 'numeric' : undefined}
                          className={`w-full rounded-lg border bg-[#161B26] px-3 py-2.5 text-sm text-white outline-none focus:border-red-500 ${paymentErrors[key] ? 'border-red-500' : 'border-gray-800'}`}
                        />
                        {paymentErrors[key] && <span className="block text-red-400">{Array.isArray(paymentErrors[key]) ? paymentErrors[key][0] : paymentErrors[key]}</span>}
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap justify-end gap-3 border-t border-gray-800 pt-4">
                    <button type="button" onClick={closeBooking} className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5">Close</button>
                    <button type="submit" disabled={paymentLoading || bookingLoading} className="rounded-lg bg-red-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50">
                      {paymentLoading ? 'Placing order...' : 'Pay and confirm'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {!hold && !order && (
              <div className="mt-6 flex justify-end gap-3 border-t border-gray-800 pt-5">
                <button type="button" onClick={closeBooking} className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5">Close</button>
                <button type="button" onClick={holdSelectedSeats} disabled={bookingLoading || seatLoading || !selectedSeats.length} className="rounded-lg bg-red-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50">
                  {bookingLoading ? 'Holding seats...' : 'Hold selected seats'}
                </button>
              </div>
            )}
            {order && <div className="mt-5 flex justify-end"><button type="button" onClick={closeBooking} className="rounded-lg bg-red-500 px-5 py-2.5 text-sm font-bold text-white">Done</button></div>}
          </section>
        </div>
      )}
    </div>
  );
}