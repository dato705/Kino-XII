import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFeaturedMovies, getNowPlayingMovies, getComingSoonMovies } from '../api/cinema';
import MovieCard from '../components/MovieCard';

const getMovies = (response) => {
  const payload = response?.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.movies)) return payload.movies;
  return [];
};

export default function Home() {
  const [featured, setFeatured] = useState(null);
  const [nowPlaying, setNowPlaying] = useState([]);
  const [comingSoon, setComingSoon] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHomeData = async () => {
      const [featuredResult, nowPlayingResult, comingSoonResult] = await Promise.allSettled([
        getFeaturedMovies(),
        getNowPlayingMovies(),
        getComingSoonMovies()
      ]);

      if (featuredResult.status === 'fulfilled') {
        const payload = featuredResult.value.data?.data || featuredResult.value.data;
        setFeatured(Array.isArray(payload) ? payload[0] : payload?.movie || payload?.featured || payload);
      }
      if (nowPlayingResult.status === 'fulfilled') setNowPlaying(getMovies(nowPlayingResult.value));
      if (comingSoonResult.status === 'fulfilled') setComingSoon(getMovies(comingSoonResult.value));
      if ([featuredResult, nowPlayingResult, comingSoonResult].some((result) => result.status === 'rejected')) {
        setError('Some cinema data could not be loaded. Please try again later.');
      }
      setLoading(false);
    };

    fetchHomeData();
  }, []);

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Banner */}
      <section className="relative rounded-3xl overflow-hidden bg-[#131722] border border-gray-800 min-h-[380px] flex items-center p-8 md:p-12">
        <div className="relative z-10 max-w-xl space-y-4">
          <span className="bg-red-500/20 text-red-400 text-xs font-extrabold px-3 py-1 rounded-full border border-red-500/30 uppercase tracking-widest">
            Featured Movie
          </span>
          <h1 className="text-4xl md:text-5xl font-black uppercase text-white tracking-wide">
            {featured?.title || 'Now showing'}
          </h1>
          {(featured?.synopsis || featured?.description) && <p className="text-xs md:text-sm text-gray-300 line-clamp-3 leading-relaxed">{featured.synopsis || featured.description}</p>}
          <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
            {featured?.genres?.length > 0 && <span>{featured.genres.map((genre) => genre.name).join(', ')}</span>}
            {featured?.runtimeMinutes && <span>{featured.runtimeMinutes} min</span>}
            {featured?.ageRating?.code && <span className="text-red-500">{featured.ageRating.code}</span>}
          </div>
          <div className="pt-2">
            <Link to="/sessions" className="inline-flex rounded-xl bg-red-500 px-6 py-3 text-xs font-bold text-white transition hover:bg-red-600">
              View Sessions
            </Link>
          </div>
        </div>
      </section>

      {/* Now Playing */}
      <section className="space-y-4">
        <h2 className="text-xl font-black uppercase tracking-wider text-white">NOW PLAYING</h2>
        {loading ? <p className="text-sm text-gray-400">Loading movies...</p> : nowPlaying.length ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {nowPlaying.map((movie, idx) => <MovieCard key={movie.id || idx} movie={movie} />)}
          </div>
        ) : <p className="text-sm text-gray-400">No movies are currently available.</p>}
      </section>

      {/* Coming Soon */}
      <section className="space-y-4">
        <h2 className="text-xl font-black uppercase tracking-wider text-white">COMING SOON</h2>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {loading ? <p className="text-sm text-gray-400">Loading movies...</p> : comingSoon.length ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {comingSoon.map((movie, idx) => <MovieCard key={movie.id || idx} movie={movie} />)}
          </div>
        ) : <p className="text-sm text-gray-400">No upcoming movies are currently available.</p>}
      </section>
    </div>
  );
}