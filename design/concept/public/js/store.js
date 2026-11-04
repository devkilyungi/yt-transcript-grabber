// One localStorage key for every saved preference. Storage can be missing or throw (private mode), so every call is guarded.
const KEY = 'house';
export const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
export const save = patch => { try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch })); } catch { /* not saved; the page still works */ } };
