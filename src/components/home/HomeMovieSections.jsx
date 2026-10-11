import { useState } from 'react';
import { Link } from 'react-router-dom';
import MovieCard from '../MovieCard';
import { formatReleaseLabel } from '../../utils/movieData';

const getMovieKey = (movie) => String(movie.id ?? movie.slug);

function NowPlayingSection({ movies, loading, loaded }) {
  const [expandedMovieId, setExpandedMovieId] = useState(null);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-extrabold uppercase text-white 2xl:text-[22px]">Now Playing</h2>
        <Link to="/sessions" className="text-[10px] font-semibold text-red-500 hover:text-red-400 2xl:text-sm">See all</Link>
      </div>
      {loading ? <div role="status" aria-label="Loading now playing movies" className="flex gap-3 overflow-hidden">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-48 w-[180px] shrink-0 animate-pulse rounded-lg bg-[#1b1d32]" />)}</div> : movies.length ? (
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {movies.map((movie) => <div key={movie.id} onPointerEnter={() => setExpandedMovieId(movie.id)} onPointerLeave={() => setExpandedMovieId((current) => current === movie.id ? null : current)} onFocusCapture={() => setExpandedMovieId(movie.id)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setExpandedMovieId(null); }} style={{ width: expandedMovieId === movie.id ? '300px' : '180px', flexBasis: expandedMovieId === movie.id ? '300px' : '180px' }} className="shrink-0 snap-start transition-[width] duration-300 ease-out">
            <MovieCard movie={movie} />
          </div>)}
        </div>
      ) : loaded ? <p className="text-sm text-gray-400">No movies are currently available.</p> : <p className="text-sm text-gray-400">Now playing movies could not be loaded. Use Retry above.</p>}
    </section>
  );
}

function ComingSoonSection({ movies, loading, loaded, notifications }) {
  const { notifying, notificationSaved, errors, subscribe, retry } = notifications;

  return (
    <section className="space-y-3 border-t border-gray-800/80 pt-5 2xl:pt-7">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-extrabold uppercase text-white 2xl:text-[22px]">Coming Soon...</h2>
        <Link to="/sessions" className="text-[10px] font-semibold text-red-500 hover:text-red-400 2xl:text-sm">See all</Link>
      </div>
      {loading ? <div role="status" aria-label="Loading upcoming movies" className="flex gap-3 overflow-hidden">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-24 w-[min(360px,80vw)] shrink-0 animate-pulse rounded-lg bg-[#1b1d32]" />)}</div> : movies.length ? (
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {movies.map((movie) => <article key={getMovieKey(movie)} className="flex w-[calc((100%-24px)/3)] min-w-[210px] max-w-[500px] shrink-0 snap-start items-center gap-2 rounded-[9px] border border-gray-800/80 bg-[#151a2a] p-2 2xl:gap-4 2xl:rounded-xl 2xl:p-4">
            <Link to={`/movies/${movie.slug || movie.id}`} aria-label={`View ${movie.title} details`} className="aspect-[16/9] w-[42%] shrink-0 overflow-hidden rounded-md bg-[#202638] outline-none focus-visible:ring-2 focus-visible:ring-red-500 2xl:rounded-lg">
              {movie.posterUrl && <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />}
            </Link>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[8px] font-bold uppercase text-red-500 2xl:text-[11px]">In cinemas {formatReleaseLabel(movie.releaseDate)}</p>
              <h3 className="truncate text-[10px] font-bold leading-3 text-white 2xl:text-sm 2xl:leading-5"><Link to={`/movies/${movie.slug || movie.id}`} className="hover:text-red-300">{movie.title}</Link></h3>
              <p className="mt-1 line-clamp-2 text-[8px] leading-3 text-gray-400 2xl:text-[11px] 2xl:leading-4">{movie.synopsis || movie.genres?.map((genre) => genre.name).join(', ')}</p>
              <button type="button" disabled={notifying[getMovieKey(movie)] || notificationSaved[getMovieKey(movie)] || movie.isNotified || movie.is_notified} onClick={() => subscribe(movie)} className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-gray-600 px-2 py-1 text-[8px] font-semibold text-gray-200 transition hover:border-red-500 hover:text-white disabled:cursor-default disabled:opacity-60 2xl:mt-2 2xl:px-3 2xl:py-1.5 2xl:text-[11px]">
                {notifying[getMovieKey(movie)] ? 'Saving...' : notificationSaved[getMovieKey(movie)] ? 'Requested' : movie.isNotified || movie.is_notified ? '✓ Notified' : '♧ Notify me'}
              </button>
              {errors[getMovieKey(movie)] && <div className="mt-1 text-[8px] text-red-300">
                <p role="alert">{errors[getMovieKey(movie)]}</p>
                <button type="button" onClick={() => retry(movie)} disabled={notifying[getMovieKey(movie)]} className="mt-1 underline disabled:opacity-50">Retry</button>
              </div>}
            </div>
          </article>)}
        </div>
      ) : loaded ? <p className="text-sm text-gray-400">No upcoming movies are currently available.</p> : <p className="text-sm text-gray-400">Upcoming movies could not be loaded. Use Retry above.</p>}
    </section>
  );
}

export default function HomeMovieSections({ nowPlaying, comingSoon, loading, loadedSections, notifications }) {
  return <>
    <NowPlayingSection movies={nowPlaying} loading={loading} loaded={loadedSections.nowPlaying} />
    <ComingSoonSection movies={comingSoon} loading={loading} loaded={loadedSections.comingSoon} notifications={notifications} />
  </>;
}