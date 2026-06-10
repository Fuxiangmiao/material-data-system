import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
});

// 请求拦截器：自动附加 Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理 401
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    return Promise.reject(error.response?.data || error);
  }
);

// === 辅助函数 ===

export function verifyPassword(password) {
  return api.post('/auth/verify-password', { password });
}

export function changePassword(oldPassword, newPassword) {
  return api.post('/auth/change-password', { oldPassword, newPassword });
}

export function deleteByFilter(module, type, source, keyword) {
  return api.post('/records/delete-by-filter', { module, type, source, keyword });
}

export function getAllForExport(module, search) {
  const params = new URLSearchParams();
  if (module) params.set('module', module);
  if (search) params.set('search', search);
  return api.get(`/records/all-for-export?${params.toString()}`);
}

export function initDatabase(module) {
  return api.post('/admin/init-database', { module });
}

export default api;
