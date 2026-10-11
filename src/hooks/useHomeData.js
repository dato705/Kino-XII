import { useEffect, useState } from 'react';
import { getComingSoonMovies, getFeaturedMovies, getNowPlayingMovies } from '../api/cinema';
import { getMoviesFromResponse } from '../utils/movieData';

export default function useHomeData() {
  const [movies, setMovies] = useState({ featured: [], nowPlaying: [], comingSoon: [] });
  const [loadedSections, setLoadedSections] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadMovies = async () => {
      // Independent sections should still render when one endpoint fails.
      const results = await Promise.allSettled([
        getFeaturedMovies(),
        getNowPlayingMovies(),
        getComingSoonMovies(),
      ]);
      if (cancelled) return;

      const [featured, nowPlaying, comingSoon] = results;
      setMovies((current) => ({
        featured: featured.status === 'fulfilled' ? getMoviesFromResponse(featured.value) : current.featured,
        nowPlaying: nowPlaying.status === 'fulfilled' ? getMoviesFromResponse(nowPlaying.value) : current.nowPlaying,
        comingSoon: comingSoon.status === 'fulfilled' ? getMoviesFromResponse(comingSoon.value) : current.comingSoon,
      }));
      setLoadedSections({
        featured: featured.status === 'fulfilled',
        nowPlaying: nowPlaying.status === 'fulfilled',
        comingSoon: comingSoon.status === 'fulfilled',
      });
      setError(results.some((result) => result.status === 'rejected')
        ? 'Some cinema data could not be loaded. Retry to refresh the unavailable sections.'
        : '');
      setLoading(false);
    };

    loadMovies();
    return () => { cancelled = true; };
  }, [retryCount]);

  const retry = () => {
    setLoading(true);
    setError('');
    setRetryCount((attempt) => attempt + 1);
  };

  const refreshComingSoon = async () => {
    const moviesResponse = await getComingSoonMovies();
    const refreshedMovies = getMoviesFromResponse(moviesResponse);
    setMovies((current) => ({ ...current, comingSoon: refreshedMovies }));
    return refreshedMovies;
  };

  return {
    featuredMovies: movies.featured,
    nowPlaying: movies.nowPlaying,
    comingSoon: movies.comingSoon,
    loadedSections,
    loading,
    error,
    retry,
    refreshComingSoon,
  };
}