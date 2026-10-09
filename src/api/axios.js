import axios from 'axios';

const API = axios.create({
  baseURL: 'https://api.kinoxii.redberryinternship.ge/api',
});

let unauthorizedHandler;
let responseInterceptorInstalled = false;
let pendingRequests = [];

// ატანოს ტოკენი თითოეულ მოთხოვნას
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

export const setupAxiosInterceptors = (onUnauthorized) => {
  unauthorizedHandler = onUnauthorized;
  if (responseInterceptorInstalled) return;

  responseInterceptorInstalled = true;
  API.interceptors.response.use((response) => response, (error) => {
    const requestUrl = error.config?.url || '';
    const isAuthRequest = ['/login', '/register', '/logout'].some((path) => requestUrl.endsWith(path));
    if (error.response?.status === 401 && !error.config?._authRetry && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      unauthorizedHandler?.(error);
      return new Promise((resolve, reject) => {
        pendingRequests.push({ config: error.config, resolve, reject });
      });
    }
    return Promise.reject(error);
  });
};

export const retryPendingRequests = () => {
  const requests = pendingRequests;
  pendingRequests = [];
  requests.forEach(({ config, resolve, reject }) => {
    API.request({ ...config, _authRetry: true }).then(resolve).catch(reject);
  });
};

export default API;