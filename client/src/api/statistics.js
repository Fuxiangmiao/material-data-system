import api from './client';

export function getStatistics(module, keyword, fieldFilters) {
  const params = new URLSearchParams();
  if (module) params.set('module', module);
  if (keyword) params.set('keyword', keyword);
  if (fieldFilters && Object.keys(fieldFilters).length > 0) {
    params.set('fieldFilters', JSON.stringify(fieldFilters));
  }
  return api.get(`/statistics?${params.toString()}`);
}

export function getFieldValues(module) {
  const params = module ? `?module=${encodeURIComponent(module)}` : '';
  return api.get(`/statistics/field-values${params}`);
}
