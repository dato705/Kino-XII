import API from './axios';

let filterOptionsRequest;

export const loginApi = (credentials) => API.post('/login', credentials);
export const registerApi = (formData) => API.post('/register', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const getProfileApi = () => API.get('/me');
export const updateProfileApi = (profile) => API.put('/profile', profile);
export const getMyTickets = (filter) => API.get('/tickets', { params: filter ? { filter } : {} });
export const refundOrder = (orderReference) => API.post(`/orders/${encodeURIComponent(orderReference)}/refund`);
export const logoutApi = (token) => API.post('/logout', null, token ? { _authToken: token } : undefined);

export const getFeaturedMovies = () => API.get('/movies/featured');
export const getNowPlayingMovies = () => API.get('/movies/now-playing');
export const getComingSoonMovies = () => API.get('/movies/coming-soon');
export const getMovieDetails = (slug) => API.get(`/movies/${slug}`);
export const notifyMovie = (movie) => API.post(`/movies/${movie}/notify`);
export const getFilterOptions = () => {
  if (!filterOptionsRequest) {
    filterOptionsRequest = API.get('/filter-options').catch((error) => {
      filterOptionsRequest = null;
      throw error;
    });
  }
  return filterOptionsRequest;
};

export const getSessions = (filters) => API.get('/sessions', { params: filters });
export const getSessionSeats = (sessionId) => API.get(`/sessions/${sessionId}/seats`);
export const createSeatHold = (sessionId, seats) =>
  API.post(`/sessions/${sessionId}/holds`, { seats });
export const getHold = (holdId) => API.get(`/holds/${holdId}`);
export const releaseHold = (holdId) => API.delete(`/holds/${holdId}`);
export const createOrder = (order) => API.post('/orders', order);