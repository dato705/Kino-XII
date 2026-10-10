import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getMovieDetails, getSessions } from '../api/cinema';
import { useAuth } from '../context/AuthContext';
import getSessionDates from '../utils/sessionDates';

const SESSION_DATES = getSessionDates();
const EMPTY_SESSIONS = [];

const unwrap = (response) => response?.data?.data ?? response?.data ?? response;

const flattenSessions = (payload) => {
  const groups = Array.isArray(payload) ? payload : payload?.sessions ?? payload?.data ?? [];
  if (!Array.isArray(groups)) return [];
  return groups.flatMap((group) => Array.isArray(group.sessions)
    ? group.sessions.map((session) => ({ ...session, movie: session.movie || group.movie }))
    : [group]);
};

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
};

const getDateLabel = (value) => {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

const getTime = (session) => {
  const value = session.startsAt || session.starts_at || session.start_time || session.datetime || session.date;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? session.time || 'Time TBA' :
    new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
};

const getVenueName = (session) => session.venue?.name || session.hall?.venue?.name || session.venueName || session.venue_name || 'Cinema';
const getHallName = (session) => session.hall?.name || session.auditorium?.name || session.room?.name || session.hall_name || '';

export default function MovieDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, token } = useAuth();
  const [movieResult, setMovieResult] = useState({ slug: '', movie: null, error: '' });
  const movieLoading = movieResult.slug !== slug;
  const movie = movieLoading ? null : movieResult.movie;
  const movieError = movieLoading ? '' : movieResult.error;
  const selectedDate = searchParams.get('date') || SESSION_DATES[0].value;
  const showtimesKey = `${slug}:${selectedDate}`;
  const [showtimesResult, setShowtimesResult] = useState({ key: '', sessions: [], error: '' });
  const sessionsLoading = Boolean(movie && showtimesResult.key !== showtimesKey);
  const sessions = showtimesResult.key === showtimesKey ? showtimesResult.sessions : EMPTY_SESSIONS;
  const sessionsError = showtimesResult.key === showtimesKey ? showtimesResult.error : '';

  useEffect(() => {
    if (!searchParams.has('date')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('date', SESSION_DATES[0].value);
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    getMovieDetails(slug)
      .then((response) => {
        if (!cancelled) setMovieResult({ slug, movie: unwrap(response)?.movie || unwrap(response), error: '' });
      })
      .catch(() => {
        if (!cancelled) setMovieResult({ slug, movie: null, error: 'Movie details could not be loaded. Please try again later.' });
      });
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (!movie?.title) return undefined;
    let cancelled = false;
    getSessions({ date: selectedDate, search: movie.title })
      .then(async (response) => {
        const payload = unwrap(response);
        const meta = response.data?.meta || response.data?.data?.meta || payload?.meta;
        const remainingPages = Math.max(1, Number(meta?.lastPage || 1)) - 1;
        const otherPages = await Promise.all(Array.from({ length: remainingPages }, (_, index) =>
          getSessions({ date: selectedDate, search: movie.title, page: index + 2 })
        ));
        if (cancelled) return;
        const allSessions = [
          ...flattenSessions(payload),
          ...otherPages.flatMap((page) => flattenSessions(unwrap(page))),
        ];
        const matchingSessions = allSessions.filter((session) => {
          const sessionMovie = session.movie || {};
          return !sessionMovie.id && !session.movie_id && !sessionMovie.slug
            ? true
            : String(sessionMovie.id ?? session.movie_id) === String(movie.id) || sessionMovie.slug === movie.slug;
        });
        setShowtimesResult({
          key: showtimesKey,
          sessions: matchingSessions.sort((left, right) => new Date(left.startsAt || left.start_time).getTime() - new Date(right.startsAt || right.start_time).getTime()),
          error: '',
        });
      })
      .catch(() => {
        if (!cancelled) {
          setShowtimesResult({ key: showtimesKey, sessions: [], error: 'Showtimes could not be loaded. Please try again later.' });
        }
      });
    return () => { cancelled = true; };
  }, [movie, selectedDate, showtimesKey]);

  const ageRating = movie?.ageRating || movie?.age_rating || {};
  const minimumAge = Number(ageRating.minAge ?? ageRating.min_age ?? 0);
  const userAge = calculateAge(user?.dateOfBirth || user?.date_of_birth);
  const ageRestricted = Boolean(token && minimumAge >= 16 && userAge !== null && userAge < minimumAge);
  const ageMessage = ageRestricted
    ? `This film is rated ${ageRating.code || `${minimumAge}+`}. You cannot buy tickets for it with this account.`
    : '';

  const groupedSessions = useMemo(() => {
    const venues = new Map();
    sessions.forEach((session) => {
      const venueName = getVenueName(session);
      const venueKey = session.venue?.id ?? session.hall?.venue?.id ?? venueName;
      if (!venues.has(venueKey)) venues.set(venueKey, { name: venueName, sessions: [] });
      venues.get(venueKey).sessions.push(session);
    });
    return [...venues.values()];
  }, [sessions]);

  const updateDate = (date) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('date', date);
    setSearchParams(nextParams);
  };

  const openSession = (session) => {
    const params = new URLSearchParams({
      date: selectedDate,
      search: movie.title,
      session: String(session.id),
    });
    navigate(`/sessions?${params.toString()}`);
  };

  if (movieLoading) return <p className="py-20 text-center text-sm text-gray-400">Loading movie details...</p>;
  if (movieError || !movie) {
    return (
      <section className="mx-auto max-w-3xl py-20 text-center">
        <p role="alert" className="text-sm text-red-300">{movieError || 'Movie not found.'}</p>
        <Link to="/" className="mt-5 inline-block text-sm font-semibold text-gray-300 hover:text-white">Back to movies</Link>
      </section>
    );
  }

  const poster = movie.posterUrl || movie.poster_url || movie.cover;
  const backdrop = movie.backdropUrl || movie.backdrop_url || poster;
  const formats = movie.formats || [];
  const casts = typeof movie.cast === 'string' ? movie.cast.split(',').map((name) => name.trim()).filter(Boolean) : movie.cast || movie.castMembers || [];

  return (
    <div className="-mx-4 -mt-6 pb-16 text-white sm:-mx-6 lg:-mx-8">
      <section className="relative isolate min-h-[300px] overflow-hidden bg-[#07111b] sm:min-h-[340px]">
        {backdrop && <img src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,19,.94)_0%,rgba(5,10,19,.78)_45%,rgba(5,10,19,.22)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(5,10,19,.65),transparent_55%)]" />
        <div className="relative mx-auto flex min-h-[300px] max-w-[1920px] items-center gap-5 px-4 py-8 sm:min-h-[340px] sm:gap-7 sm:px-6 lg:gap-8 lg:px-8">
          {poster && <img src={poster} alt={`${movie.title} poster`} className="aspect-[2/3] w-28 shrink-0 rounded-lg object-cover shadow-2xl sm:w-36 lg:w-40" />}
          <div className="max-w-2xl min-w-0">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-red-400">{movie.kind || 'Film'}</p>
            <h1 className="text-2xl font-black uppercase leading-tight sm:text-3xl lg:text-4xl">{movie.title}</h1>
            {movie.synopsis && <p className="mt-3 line-clamp-4 max-w-xl text-xs leading-relaxed text-gray-200 sm:text-sm">{movie.synopsis}</p>}
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold">
              {ageRating.code && <span className="rounded-full bg-red-500/80 px-2.5 py-1">{ageRating.code}</span>}
              {movie.runtimeMinutes && <span className="rounded-full bg-white/15 px-2.5 py-1">{movie.runtimeMinutes} min</span>}
              {formats.map((format) => <span key={format.slug || format.id || format.name} className="rounded-full bg-white/15 px-2.5 py-1">{format.name || format.label || format}</span>)}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1920px] gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_230px] lg:px-8">
        <section className="min-w-0">
          <h2 className="text-base font-bold">Sessions</h2>
          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2">
            {SESSION_DATES.map((date) => (
              <button
                key={date.value}
                type="button"
                aria-pressed={selectedDate === date.value}
                onClick={() => updateDate(date.value)}
                className={`flex h-[62px] w-[62px] shrink-0 flex-col items-center justify-center rounded-2xl text-center text-[9px] transition sm:h-[68px] sm:w-[68px] ${selectedDate === date.value ? 'bg-[#f12d13] text-white' : 'bg-[#191c2e] text-gray-300 hover:bg-[#252940]'}`}
              >
                <span className="block">{date.weekday}</span>
                <span className="mt-0.5 block font-bold">{date.day}</span>
              </button>
            ))}
          </div>

          {ageRestricted && <p role="alert" className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">{ageMessage}</p>}
          {sessionsError && <p role="alert" className="mt-4 text-xs text-red-300">{sessionsError}</p>}
          {sessionsLoading ? <p className="py-10 text-center text-xs text-gray-400">Loading showtimes...</p> : groupedSessions.length ? (
            <div className="mt-5 space-y-5">
              {groupedSessions.map((venue) => (
                <section key={venue.name}>
                  <h3 className="mb-2 text-[10px] font-bold text-gray-100">{venue.name}</h3>
                  <div className="flex flex-wrap items-start gap-2">
                    {venue.sessions.map((session) => {
                      const hallName = getHallName(session) || 'General admission';
                            const seatsLeft = session.seatsLeft ?? session.seats_left ?? session.availableSeats ?? session.available_seats;
                            const soldOut = session.isSoldOut || session.is_sold_out || Number(seatsLeft) === 0;
                            const format = session.format?.name || session.format?.label || session.format;
                            const language = session.language?.code || session.language?.name || session.language?.label || session.language;
                            const disabled = ageRestricted || soldOut || !session.id;
                            return (
                              <article key={session.id} className="w-full max-w-[260px] rounded-2xl bg-[#1b1d30] p-3">
                                <h4 className="mb-2 text-[9px] font-medium text-gray-300">Hall {hallName}</h4>
                                <button
                                  type="button"
                                  onClick={() => openSession(session)}
                                  disabled={disabled}
                                  title={ageRestricted ? ageMessage : soldOut ? 'Sold out' : undefined}
                                  className={`flex min-h-[86px] w-full min-w-0 items-stretch overflow-hidden rounded-xl text-left transition ${disabled ? 'cursor-not-allowed opacity-55' : 'hover:brightness-125'}`}
                                >
                                  <span className="flex min-w-0 flex-1 flex-col justify-center gap-2.5 bg-[#070b1b] px-3 py-2.5">
                                    <span className="text-lg font-bold leading-none">{getTime(session)}</span>
                                    <span className="flex min-w-0 items-center gap-1.5 text-[8px] text-gray-400">
                                      <span className="truncate">{language === 'Georgian Subtitles' ? 'ENG' : language === 'Georgian Dub' ? 'GEO' : language === 'Russian Dub' ? 'RUS' : language || 'ENG'}</span>
                                      <span className="max-w-16 truncate rounded-full bg-[#25283a] px-2 py-0.5 text-[7px] font-semibold text-gray-300">{format || 'Standard'}</span>
                                    </span>
                                  </span>
                                  <span className="relative flex w-[76px] shrink-0 flex-col items-center justify-center gap-1.5 border-l border-dashed border-white/25 bg-[#070b1b] px-2 text-center before:absolute before:-left-[5px] before:top-[-5px] before:h-2.5 before:w-2.5 before:rounded-full before:bg-[#1b1d30] after:absolute after:-left-[5px] after:bottom-[-5px] after:h-2.5 after:w-2.5 after:rounded-full after:bg-[#1b1d30]">
                                    <span className="flex items-center gap-1 text-sm font-bold text-[#f12d13]">
                                      <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v2a2 2 0 0 0 0 4v3A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-3a2 2 0 0 0 0-4v-2Zm6 0a.6.6 0 0 0-.6.6v.8a.6.6 0 1 0 1.2 0v-.8a.6.6 0 0 0-.6-.6Zm0 3a.6.6 0 0 0-.6.6v.8a.6.6 0 1 0 1.2 0v-.8a.6.6 0 0 0-.6-.6Zm0 3a.6.6 0 0 0-.6.6v.8a.6.6 0 1 0 1.2 0v-.8a.6.6 0 0 0-.6-.6Z" /></svg>
                                      {session.price ?? session.ticketPrice ?? session.ticket_price ?? movie.fromPrice ?? '—'}
                                    </span>
                                    <span className={`flex items-center gap-1 text-[10px] ${soldOut ? 'text-gray-500' : 'text-gray-400'}`}>
                                      {!soldOut && <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v2a2 2 0 0 0 0 4v3A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-3a2 2 0 0 0 0-4v-2Z" /></svg>}
                                      {soldOut ? 'Sold out' : `${seatsLeft ?? '—'} left`}
                                    </span>
                                  </span>
                                </button>
                              </article>
                            );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : !sessionsError ? <p className="py-10 text-center text-xs text-gray-400">No sessions available for {getDateLabel(selectedDate)}.</p> : null}
        </section>

        <aside className="border-t border-gray-800 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <h2 className="text-base font-bold">Details</h2>
          <dl className="mt-4 space-y-4 text-[9px]">
            <div><dt className="font-semibold uppercase text-gray-500">Director</dt><dd className="mt-1 text-gray-200">{movie.director || movie.directors || '—'}</dd></div>
            <div><dt className="font-semibold uppercase text-gray-500">Main cast</dt><dd className="mt-1 leading-relaxed text-gray-200">{Array.isArray(casts) ? casts.map((actor) => typeof actor === 'string' ? actor : actor.name).join(', ') : casts || '—'}</dd></div>
            <div><dt className="font-semibold uppercase text-gray-500">Duration</dt><dd className="mt-1 text-gray-200">{movie.runtimeMinutes ? `${movie.runtimeMinutes} minutes` : '—'}</dd></div>
            <div><dt className="font-semibold uppercase text-gray-500">Release date</dt><dd className="mt-1 text-gray-200">{movie.releaseDate ? getDateLabel(movie.releaseDate) : '—'}</dd></div>
            <div><dt className="font-semibold uppercase text-gray-500">Formats</dt><dd className="mt-1 text-gray-200">{formats.map((format) => format.name || format.label || format).join(', ') || '—'}</dd></div>
            <div><dt className="font-semibold uppercase text-gray-500">From</dt><dd className="mt-1 font-semibold text-white">₾{movie.fromPrice ?? '—'}</dd></div>
          </dl>
          {ageRating.description && <p className="mt-5 rounded-lg bg-amber-500/10 p-3 text-[9px] leading-relaxed text-amber-300"><strong className="block uppercase">Rating note</strong><span className="mt-1 block">{ageRating.description}</span></p>}
        </aside>
      </div>
    </div>
  );
}
