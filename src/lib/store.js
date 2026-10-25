// Browser storage helpers. Storage can be unavailable (private mode, previews),
// so every access is guarded and the app works without it.
const PREFIX = 'streettree-studio:';

export function load(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function save(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    /* storage unavailable – keep working in memory */
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10);
