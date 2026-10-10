import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getComingSoonMovies, getFeaturedMovies, getNowPlayingMovies, notifyMovie } from '../api/cinema';
import MovieCard from '../components/MovieCard';

const getMovies = (response) => {
  const payload = response?.data?.data ?? response?.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.movies)) return payload.movies;
  return [];
};

const releaseLabel = (date) => {
  if (!date) return 'COMING SOON';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(date).toUpperCase();
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(parsed).toUpperCase();
};

export default function Home() {
  const [featuredMovies, setFeaturedMovies] = useState([]);
  const [nowPlaying, setNowPlaying] = useState([]);
  const [comingSoon, setComingSoon] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [expandedMovieId, setExpandedMovieId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadRetry, setLoadRetry] = useState(0);
  const [loadedSections, setLoadedSections] = useState({});
  const [notifying, setNotifying] = useState({});
  const [notificationSaved, setNotificationSaved] = useState({});
  const [notifyErrors, setNotifyErrors] = useState({});
  const notifyLocks = useRef(new Set());
  const navigate = useNavigate();
  const heroSlides = featuredMovies.slice(0, 6);

  useEffect(() => {
    let cancelled = false;
    const fetchHomeData = async () => {
      const [featuredResult, nowPlayingResult, comingSoonResult] = await Promise.allSettled([
        getFeaturedMovies(),
        getNowPlayingMovies(),
        getComingSoonMovies(),
      ]);

      if (cancelled) return;
      if (featuredResult.status === 'fulfilled') setFeaturedMovies(getMovies(featuredResult.value));
      if (nowPlayingResult.status === 'fulfilled') setNowPlaying(getMovies(nowPlayingResult.value));
      if (comingSoonResult.status === 'fulfilled') setComingSoon(getMovies(comingSoonResult.value));
      setLoadedSections({
        featured: featuredResult.status === 'fulfilled',
        nowPlaying: nowPlayingResult.status === 'fulfilled',
        comingSoon: comingSoonResult.status === 'fulfilled',
      });
      if ([featuredResult, nowPlayingResult, comingSoonResult].some((result) => result.status === 'rejected')) {
        setError('Some cinema data could not be loaded. Retry to refresh the unavailable sections.');
      }
      setLoading(false);
    };

    fetchHomeData();
    return () => { cancelled = true; };
  }, [loadRetry]);

  useEffect(() => {
    if (heroPaused || heroSlides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % heroSlides.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeIndex, heroPaused, heroSlides.length]);

  const moveFeatured = (direction) => {
    if (!heroSlides.length) return;
    setActiveIndex((current) => (current + direction + heroSlides.length) % heroSlides.length);
  };

  const openFeaturedMovie = (movie) => {
    navigate(`/movies/${movie?.slug || movie?.id}`);
  };

  const runNotification = async (movie, refreshOnly = false) => {
    if (notifyLocks.current.has(movie.id)) return;
    notifyLocks.current.add(movie.id);
    let savedOnServer = refreshOnly;
    setNotifyErrors((current) => ({ ...current, [movie.id]: '' }));
    setNotifying((current) => ({ ...current, [movie.id]: true }));
    try {
      if (!refreshOnly) {
        await notifyMovie(movie.slug);
        savedOnServer = true;
        setNotificationSaved((current) => ({ ...current, [movie.id]: true }));
      }
      const response = await getComingSoonMovies();
      const refreshedMovies = getMovies(response);
      setComingSoon(refreshedMovies);
      setNotificationSaved((current) => ({ ...current, [movie.id]: false }));
    } catch (requestError) {
      setNotificationSaved((current) => ({ ...current, [movie.id]: savedOnServer }));
      setNotifyErrors((current) => ({
        ...current,
        [movie.id]: savedOnServer
          ? 'Your request was saved, but its status could not be refreshed.'
          : requestError.response?.data?.message || 'Could not save your notification. Please retry.',
      }));
    } finally {
      notifyLocks.current.delete(movie.id);
      setNotifying((current) => ({ ...current, [movie.id]: false }));
    }
  };

  const subscribeToMovie = (movie) => {
    executeProtected(() => runNotification(movie));
  };

  const retryNotification = (movie) => {
    executeProtected(() => runNotification(movie, Boolean(notificationSaved[movie.id])));
  };

  return (
    <div className="-mt-6 space-y-4 pb-16">
      {error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
        <p role="alert">{error}</p>
          <button type="button" onClick={() => {
            setLoading(true);
            setError('');
            setLoadRetry((attempt) => attempt + 1);
          }} disabled={loading} className="rounded-full bg-red-500/20 px-3 py-1.5 font-semibold text-white disabled:opacity-50">{loading ? 'Retrying...' : 'Retry'}</button>
      </div>}
      <section
        className="relative isolate h-[270px] overflow-hidden bg-[#07111b] xl:h-[350px] 2xl:h-[430px]"
        onMouseEnter={() => setHeroPaused(true)}
        onMouseLeave={() => setHeroPaused(false)}
        onFocus={() => setHeroPaused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setHeroPaused(false);
        }}
      >
        {heroSlides.map((movie, index) => {
          const isActive = index === activeIndex;
          return (
            <article
              key={movie.id}
              aria-hidden={!isActive}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${isActive ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            >
              {movie.backdropUrl && <img src={movie.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />}
              <div className="absolute inset-0 bg-gradient-to-r from-[#07121d] via-[#07121d]/90 to-[#07121d]/10" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#07111b]/90 via-transparent to-[#07111b]/10" />

              <div className="absolute inset-y-0 left-0 z-10 flex max-w-[min(68%,540px)] flex-col justify-center px-4 pb-8 pt-4 sm:px-6 2xl:max-w-[760px] 2xl:px-10">
                <span className="mb-2 w-fit rounded-sm border border-red-500/30 bg-red-500/10 px-2 py-1 text-[9px] font-bold uppercase text-red-400 2xl:mb-4 2xl:px-3 2xl:py-2 2xl:text-xs">
                  Premiere · Week of {releaseLabel(movie.releaseDate)}
                </span>
                <h1 className="text-[25px] font-black uppercase leading-[1.05] text-white sm:text-[32px] 2xl:text-[48px]">
                  <Link to={`/movies/${movie.slug || movie.id}`} tabIndex={isActive ? 0 : -1} className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-red-500">{movie.title}</Link>
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] font-semibold text-gray-200 2xl:mt-4 2xl:gap-2 2xl:text-xs">
                  {movie.ageRating?.code && <span className="rounded-full bg-red-500/80 px-2 py-1 text-white 2xl:px-3 2xl:py-1.5">{movie.ageRating.code}</span>}
                  {movie.runtimeMinutes && <span className="rounded-full bg-white/10 px-2 py-1 2xl:px-3 2xl:py-1.5">◷ {movie.runtimeMinutes} min</span>}
                  {movie.formats?.slice(0, 2).map((format) => <span key={format.slug} className="rounded-full bg-white/10 px-2 py-1 2xl:px-3 2xl:py-1.5">{format.name}</span>)}
                </div>
                {movie.synopsis && <p className="mt-2 line-clamp-3 max-w-[420px] text-[10px] leading-[1.45] text-gray-300 sm:text-[11px] 2xl:mt-4 2xl:max-w-[700px] 2xl:text-base">{movie.synopsis}</p>}
                <div className="mt-3 flex flex-wrap gap-2 2xl:mt-5 2xl:gap-3">
                  <button type="button" tabIndex={isActive ? 0 : -1} onClick={() => openFeaturedMovie(movie)} className="inline-flex h-8 items-center gap-2 rounded-full bg-[#f12d13] px-3 text-[10px] font-bold text-white transition hover:bg-red-600 2xl:h-11 2xl:px-5 2xl:text-sm">
                    <svg viewBox="0 0 20 20" className="h-3 w-3 2xl:h-4 2xl:w-4" fill="currentColor" aria-hidden="true"><path d="M4 3h12a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4V4a1 1 0 0 1 1-1Zm5 2v2h2V5H9Zm0 4v2h2V9H9Zm0 4v2h2v-2H9Z" /></svg>
                    Buy tickets
                  </button>
                  <Link to="/sessions" tabIndex={isActive ? 0 : -1} className="inline-flex h-8 items-center rounded-full bg-white/10 px-3 text-[10px] font-bold text-gray-100 transition hover:bg-white/20 2xl:h-11 2xl:px-5 2xl:text-sm">
                    All sessions
                  </Link>
                </div>
              </div>
            </article>
          );
        })}

        {!heroSlides.length && <h1 className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-black uppercase text-white">{loading ? 'Loading featured films...' : loadedSections.featured ? 'Cinema, on screen' : 'Featured films unavailable'}</h1>}

        {heroSlides.length > 1 && (
          <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center gap-3 sm:bottom-5 sm:left-6 sm:right-6 2xl:bottom-8 2xl:left-10 2xl:right-10">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {featuredMovies.slice(0, 6).map((movie, index) => (
                <button
                  key={movie.id}
                  type="button"
                  aria-label={`Show featured movie ${index + 1}: ${movie.title}`}
                  aria-current={activeIndex === index ? 'true' : undefined}
                  onClick={() => setActiveIndex(index)}
                  className={`h-[2px] flex-1 transition 2xl:h-[3px] ${activeIndex === index ? 'bg-[#f12d13]' : 'bg-white/80 hover:bg-white'}`}
                />
              ))}
            </div>
            <button type="button" aria-label="Previous featured movie" onClick={() => moveFeatured(-1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/20 text-white transition hover:bg-white/20 2xl:h-10 2xl:w-10 2xl:text-xl">‹</button>
            <button type="button" aria-label="Next featured movie" onClick={() => moveFeatured(1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/20 text-white transition hover:bg-white/20 2xl:h-10 2xl:w-10 2xl:text-xl">›</button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold uppercase text-white 2xl:text-[22px]">Now Playing</h2>
          <Link to="/sessions" className="text-[10px] font-semibold text-red-500 hover:text-red-400 2xl:text-sm">See all</Link>
        </div>
        {loading ? <div role="status" aria-label="Loading now playing movies" className="flex gap-3 overflow-hidden">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-48 w-[180px] shrink-0 animate-pulse rounded-lg bg-[#1b1d32]" />)}</div> : nowPlaying.length ? (
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {nowPlaying.map((movie) => (
              <div
                key={movie.id}
                onPointerEnter={() => setExpandedMovieId(movie.id)}
                onPointerLeave={() => setExpandedMovieId((current) => current === movie.id ? null : current)}
                onFocusCapture={() => setExpandedMovieId(movie.id)}
                onBlurCapture={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setExpandedMovieId(null);
                }}
                style={{
                  width: expandedMovieId === movie.id ? '300px' : '180px',
                  flexBasis: expandedMovieId === movie.id ? '300px' : '180px',
                }}
                className="shrink-0 snap-start transition-[width] duration-300 ease-out"
              >
                <MovieCard movie={movie} />
              </div>
            ))}
          </div>
        ) : loadedSections.nowPlaying ? <p className="text-sm text-gray-400">No movies are currently available.</p> : <p className="text-sm text-gray-400">Now playing movies could not be loaded. Use Retry above.</p>}
      </section>

      <section className="space-y-3 border-t border-gray-800/80 pt-5 2xl:pt-7">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold uppercase text-white 2xl:text-[22px]">Coming Soon...</h2>
          <Link to="/sessions" className="text-[10px] font-semibold text-red-500 hover:text-red-400 2xl:text-sm">See all</Link>
        </div>
        {loading ? <div role="status" aria-label="Loading upcoming movies" className="flex gap-3 overflow-hidden">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-24 w-[min(360px,80vw)] shrink-0 animate-pulse rounded-lg bg-[#1b1d32]" />)}</div> : comingSoon.length ? (
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {comingSoon.map((movie) => (
              <article key={movie.id} className="flex w-[calc((100%-24px)/3)] min-w-[210px] max-w-[500px] shrink-0 snap-start items-center gap-2 rounded-[9px] border border-gray-800/80 bg-[#151a2a] p-2 2xl:gap-4 2xl:rounded-xl 2xl:p-4">
                <Link to={`/movies/${movie.slug || movie.id}`} aria-label={`View ${movie.title} details`} className="aspect-[16/9] w-[42%] shrink-0 overflow-hidden rounded-md bg-[#202638] outline-none focus-visible:ring-2 focus-visible:ring-red-500 2xl:rounded-lg">
                  {movie.posterUrl && <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[8px] font-bold uppercase text-red-500 2xl:text-[11px]">In cinemas {releaseLabel(movie.releaseDate)}</p>
                  <h3 className="truncate text-[10px] font-bold leading-3 text-white 2xl:text-sm 2xl:leading-5"><Link to={`/movies/${movie.slug || movie.id}`} className="hover:text-red-300">{movie.title}</Link></h3>
                  <p className="mt-1 line-clamp-2 text-[8px] leading-3 text-gray-400 2xl:text-[11px] 2xl:leading-4">{movie.synopsis || movie.genres?.map((genre) => genre.name).join(', ')}</p>
                  <button
                    type="button"
                    disabled={notifying[movie.id] || notificationSaved[movie.id] || movie.isNotified || movie.is_notified}
                    onClick={() => subscribeToMovie(movie)}
                    className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-gray-600 px-2 py-1 text-[8px] font-semibold text-gray-200 transition hover:border-red-500 hover:text-white disabled:cursor-default disabled:opacity-60 2xl:mt-2 2xl:px-3 2xl:py-1.5 2xl:text-[11px]"
                  >
                    {notifying[movie.id] ? 'Saving...' : notificationSaved[movie.id] ? 'Requested' : movie.isNotified || movie.is_notified ? '✓ Notified' : '♧ Notify me'}
                  </button>
                  {notifyErrors[movie.id] && <div className="mt-1 text-[8px] text-red-300">
                    <p role="alert">{notifyErrors[movie.id]}</p>
                    <button type="button" onClick={() => retryNotification(movie)} disabled={notifying[movie.id]} className="mt-1 underline disabled:opacity-50">Retry</button>
                  </div>}
                </div>
              </article>
            ))}
          </div>
        ) : loadedSections.comingSoon ? <p className="text-sm text-gray-400">No upcoming movies are currently available.</p> : <p className="text-sm text-gray-400">Upcoming movies could not be loaded. Use Retry above.</p>}
      </section>
    </div>
  );
}
