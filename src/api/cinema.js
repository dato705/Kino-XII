import apiClient from './axios';

export const getFilterOptions = () => apiClient.get('/filter-options');
export const getNowPlayingMovies = () => apiClient.get('/movies/now-playing');
export const getComingSoonMovies = () => apiClient.get('/movies/coming-soon');
export const getFeaturedMovies = () => apiClient.get('/movies/featured');