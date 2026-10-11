export const getMoviesFromResponse = (response) => {
  const payload = response?.data?.data ?? response?.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.movies)) return payload.movies;
  return [];
};

export const formatReleaseLabel = (date) => {
  if (!date) return 'COMING SOON';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(date).toUpperCase();
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(parsed).toUpperCase();
};