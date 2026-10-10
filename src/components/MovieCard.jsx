import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Reusable Movie Card Component matching Figma layout
export default function MovieCard({ movie }) {
  const { executeProtected } = useAuth();
  const navigate = useNavigate();
  const [isSynopsisOpen, setIsSynopsisOpen] = useState(false);
  const synopsis = movie?.synopsis || movie?.description || movie?.overview;

  return (
    <div
      tabIndex={0}
      data-synopsis-open={isSynopsisOpen}
      onPointerEnter={() => setIsSynopsisOpen(true)}
      onPointerLeave={() => setIsSynopsisOpen(false)}
      onFocus={() => setIsSynopsisOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsSynopsisOpen(false);
      }}
      className="movie-card group relative z-0 flex w-full cursor-pointer flex-col justify-between rounded-[10px] border border-gray-800/70 bg-[#151a2a] p-1.5 transition duration-300 hover:z-20 hover:-translate-y-1 hover:border-red-500/50 hover:shadow-xl focus-within:z-20 focus-within:border-red-500/50 focus-within:shadow-xl 2xl:rounded-xl 2xl:p-2"
    >
      <div className="space-y-2 2xl:space-y-2">
        {/* Movie Poster Aspect Ratio */}
        <div
          style={{ aspectRatio: isSynopsisOpen ? '16 / 9' : '3 / 4' }}
          className="relative w-full overflow-hidden rounded-[7px] bg-gray-800 2xl:rounded-xl"
        >
          {movie?.posterUrl || movie?.poster_url || movie?.cover ? (
            <img 
              src={movie.posterUrl || movie.poster_url || movie.cover}
              alt={movie.title || 'Movie'} 
              className="h-full w-full object-cover object-center transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
              No Poster
            </div>
          )}
        </div>

        {/* Movie Info */}
        <div className="min-w-0">
          <h3 className="truncate text-[12px] font-bold leading-4 text-white 2xl:text-sm 2xl:leading-5">{movie?.title || movie?.name || 'Untitled'}</h3>
          <p className="truncate text-[9px] leading-3 text-gray-400 2xl:text-[10px] 2xl:leading-[14px]">
            {(movie?.genres || []).map((genre) => genre.name).join(', ') || movie?.genre || 'Film'} · {movie?.runtimeMinutes || movie?.duration || '—'} min
          </p>
          <span className="mt-1 inline-block text-[9px] font-bold leading-3 text-red-500 2xl:text-[10px] 2xl:leading-[14px]">
            {movie?.ageRating?.code || movie?.age_limit || 'All ages'}
          </span>
          {isSynopsisOpen && synopsis && (
            <p className="movie-card__synopsis line-clamp-3 pt-1.5 text-[10px] leading-[1.4] text-gray-300 2xl:pt-1.5 2xl:text-[11px]">
              {synopsis}
            </p>
          )}
        </div>
      </div>

      {/* Ticket Action Footer */}
      <div className="mt-2 flex items-center justify-between gap-1 border-t border-gray-800/50 pt-1.5 2xl:mt-2 2xl:gap-2 2xl:pt-2">
        <span className="min-w-0 text-[9px] leading-3 text-gray-400 2xl:text-[10px] 2xl:leading-[14px]">
          From <strong className="text-white">₾{movie?.fromPrice ?? movie?.price ?? 0}</strong>
        </span>
        <button
          onClick={() => executeProtected(() => navigate('/sessions'))}
          className="shrink-0 rounded-md bg-[#f12d13] px-2 py-1.5 text-[9px] font-bold leading-3 text-white transition hover:bg-red-600 2xl:rounded-md 2xl:px-3 2xl:py-1.5 2xl:text-[10px] 2xl:leading-3"
        >
          Buy Ticket
        </button>
      </div>
    </div>
  );
}