import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.kinoxii.redberryinternship.ge/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// ტოკენის ავტომატურად გაყოლება ავტორიზებული მოთხოვნებისთვის
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;