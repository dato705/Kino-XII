import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Reusable Movie Card Component matching Figma layout
export default function MovieCard({ movie }) {
  const { executeProtected } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="bg-[#131722] rounded-2xl p-3 border border-gray-800/60 space-y-3 hover:border-red-500/50 transition cursor-pointer flex flex-col justify-between group">
      <div className="space-y-3">
        {/* Movie Poster Aspect Ratio */}
        <div className="aspect-[3/4] bg-gray-800 rounded-xl overflow-hidden relative">
          {movie?.posterUrl || movie?.poster_url || movie?.cover ? (
            <img 
              src={movie.posterUrl || movie.poster_url || movie.cover}
              alt={movie.title || 'Movie'} 
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
              No Poster
            </div>
          )}
        </div>

        {/* Movie Info */}
        <div>
          <h3 className="font-bold text-sm text-white truncate">{movie?.title || movie?.name || 'Untitled'}</h3>
          <p className="text-[11px] text-gray-400 truncate">
            {(movie?.genres || []).map((genre) => genre.name).join(', ') || movie?.genre || 'Film'} · {movie?.runtimeMinutes || movie?.duration || '—'} min
          </p>
          <span className="text-[10px] font-bold text-red-500 mt-1 inline-block">
            {movie?.ageRating?.code || movie?.age_limit || 'All ages'}
          </span>
        </div>
      </div>

      {/* Ticket Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-800/40">
        <span className="text-[11px] text-gray-400">
          From <strong className="text-white">₾ {movie?.fromPrice ?? movie?.price ?? 0}</strong>
        </span>
        <button
          onClick={() => executeProtected(() => navigate('/sessions'))}
          className="bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition"
        >
          View Sessions
        </button>
      </div>
    </div>
  );
}