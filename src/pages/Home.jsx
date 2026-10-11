import { useNavigate } from 'react-router-dom';
import HomeHero from '../components/home/HomeHero';
import HomeMovieSections from '../components/home/HomeMovieSections';
import useHomeData from '../hooks/useHomeData';
import useMovieNotifications from '../hooks/useMovieNotifications';

export default function Home() {
  const { featuredMovies, nowPlaying, comingSoon, loading, error, loadedSections, retry, refreshComingSoon } = useHomeData();
  const notifications = useMovieNotifications(refreshComingSoon);
  const navigate = useNavigate();

  return (
    <div className="-mt-6 space-y-4 pb-16">
      {error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
        <p role="alert">{error}</p>
        <button type="button" onClick={retry} disabled={loading} className="rounded-full bg-red-500/20 px-3 py-1.5 font-semibold text-white disabled:opacity-50">
          {loading ? 'Retrying...' : 'Retry'}
        </button>
      </div>}
      <HomeHero
        movies={featuredMovies}
        loading={loading}
        loaded={loadedSections.featured}
        onOpenMovie={(movie) => navigate(`/movies/${movie?.slug || movie?.id}`)}
      />
      <HomeMovieSections nowPlaying={nowPlaying} comingSoon={comingSoon} loading={loading} loadedSections={loadedSections} notifications={notifications} />
    </div>
  );
}
