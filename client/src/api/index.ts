/**
 * PeoplePay360 — API Entry Point
 * Exports real or mock API based on VITE_USE_MOCK env variable.
 */
import { mockApi } from './mock';
import { realApi } from './client';

const useMock = import.meta.env.VITE_USE_MOCK === 'true';

const api = useMock ? mockApi : realApi;

export default api;
