import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatReleaseLabel } from '../../utils/movieData';

export default function HomeHero({ movies, loading, loaded, onOpenMovie }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slides = movies.slice(0, 6);

  useEffect(() => {
    if (paused || slides.length < 2) return undefined;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % slides.length), 3000);
    return () => window.clearInterval(timer);
  }, [activeIndex, paused, slides.length]);

  const moveFeatured = (direction) => {
    if (slides.length) setActiveIndex((current) => (current + direction + slides.length) % slides.length);
  };

  return (
    <section
      className="relative isolate h-[270px] overflow-hidden bg-[#07111b] xl:h-[350px] 2xl:h-[430px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
    >
      {slides.map((movie, index) => {
        const isActive = index === activeIndex;
        return (
          <article key={movie.id} aria-hidden={!isActive} className={`absolute inset-0 transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${isActive ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
            {movie.backdropUrl && <img src={movie.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />}
            <div className="absolute inset-0 bg-gradient-to-r from-[#07121d] via-[#07121d]/90 to-[#07121d]/10" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07111b]/90 via-transparent to-[#07111b]/10" />
            <div className="absolute inset-y-0 left-0 z-10 flex max-w-[min(68%,540px)] flex-col justify-center px-4 pb-8 pt-4 sm:px-6 2xl:max-w-[760px] 2xl:px-10">
              <span className="mb-2 w-fit rounded-sm border border-red-500/30 bg-red-500/10 px-2 py-1 text-[9px] font-bold uppercase text-red-400 2xl:mb-4 2xl:px-3 2xl:py-2 2xl:text-xs">Premiere · Week of {formatReleaseLabel(movie.releaseDate)}</span>
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
                <button type="button" tabIndex={isActive ? 0 : -1} onClick={() => onOpenMovie(movie)} className="inline-flex h-8 items-center gap-2 rounded-full bg-[#f12d13] px-3 text-[10px] font-bold text-white transition hover:bg-red-600 2xl:h-11 2xl:px-5 2xl:text-sm">
                  <svg viewBox="0 0 20 20" className="h-3 w-3 2xl:h-4 2xl:w-4" fill="currentColor" aria-hidden="true"><path d="M4 3h12a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4V4a1 1 0 0 1 1-1Zm5 2v2h2V5H9Zm0 4v2h2V9H9Zm0 4v2h2v-2H9Z" /></svg>
                  Buy tickets
                </button>
                <Link to="/sessions" tabIndex={isActive ? 0 : -1} className="inline-flex h-8 items-center rounded-full bg-white/10 px-3 text-[10px] font-bold text-gray-100 transition hover:bg-white/20 2xl:h-11 2xl:px-5 2xl:text-sm">All sessions</Link>
              </div>
            </div>
          </article>
        );
      })}

      {!slides.length && <h1 className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-black uppercase text-white">{loading ? 'Loading featured films...' : loaded ? 'Cinema, on screen' : 'Featured films unavailable'}</h1>}
      {slides.length > 1 && <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center gap-3 sm:bottom-5 sm:left-6 sm:right-6 2xl:bottom-8 2xl:left-10 2xl:right-10">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {slides.map((movie, index) => <button key={movie.id} type="button" aria-label={`Show featured movie ${index + 1}: ${movie.title}`} aria-current={activeIndex === index ? 'true' : undefined} onClick={() => setActiveIndex(index)} className={`h-[2px] flex-1 transition 2xl:h-[3px] ${activeIndex === index ? 'bg-[#f12d13]' : 'bg-white/80 hover:bg-white'}`} />)}
        </div>
        <button type="button" aria-label="Previous featured movie" onClick={() => moveFeatured(-1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/20 text-white transition hover:bg-white/20 2xl:h-10 2xl:w-10 2xl:text-xl">‹</button>
        <button type="button" aria-label="Next featured movie" onClick={() => moveFeatured(1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/20 text-white transition hover:bg-white/20 2xl:h-10 2xl:w-10 2xl:text-xl">›</button>
      </div>}
    </section>
  );
}