import api from './client';

export function compareImportData(titles, module) {
  return api.post('/compare-import', { titles, module });
}

export function matchAndFillRecords(records, module) {
  return api.post('/compare-import/match-and-fill', { records, module });
}
