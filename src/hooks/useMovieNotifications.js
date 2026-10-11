import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { notifyMovie } from '../api/cinema';
import { clearIdempotencyKey, getIdempotencyKey } from '../utils/idempotency';

export default function useMovieNotifications(refreshMovies) {
  const { executeProtected } = useAuth();
  const [notifying, setNotifying] = useState({});
  const [notificationSaved, setNotificationSaved] = useState({});
  const [errors, setErrors] = useState({});
  const requestLocks = useRef(new Set());

  const runNotification = async (movie, refreshOnly = false) => {
    const movieKey = String(movie.id ?? movie.slug);
    if (requestLocks.current.has(movieKey)) return;
    requestLocks.current.add(movieKey);

    const operation = `notification:${movieKey}`;
    let savedOnServer = refreshOnly;
    setErrors((current) => ({ ...current, [movieKey]: '' }));
    setNotifying((current) => ({ ...current, [movieKey]: true }));

    try {
      if (!refreshOnly) {
        // Reuse the key when a lost response makes the mutation outcome uncertain.
        await notifyMovie(movie.slug, getIdempotencyKey(operation));
        clearIdempotencyKey(operation);
        savedOnServer = true;
        setNotificationSaved((current) => ({ ...current, [movieKey]: true }));
      }

      await refreshMovies();
      setNotificationSaved((current) => ({ ...current, [movieKey]: false }));
    } catch (requestError) {
      setNotificationSaved((current) => ({ ...current, [movieKey]: savedOnServer }));
      setErrors((current) => ({
        ...current,
        [movieKey]: savedOnServer
          ? 'Your request was saved, but its status could not be refreshed.'
          : requestError.response?.data?.message || 'Could not save your notification. Please retry.',
      }));
    } finally {
      requestLocks.current.delete(movieKey);
      setNotifying((current) => ({ ...current, [movieKey]: false }));
    }
  };

  const subscribe = (movie) => executeProtected(() => runNotification(movie));
  const retry = (movie) => {
    const movieKey = String(movie.id ?? movie.slug);
    executeProtected(() => runNotification(movie, Boolean(notificationSaved[movieKey])));
  };

  return { notifying, notificationSaved, errors, subscribe, retry };
}