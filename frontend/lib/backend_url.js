// Simple backend URL configuration
// Use IPv4 localhost by default to avoid Node resolving localhost to ::1.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5001";

// Export the backend URL directly
export function getBackendUrl() {
  return Promise.resolve(BACKEND_URL);
}

export { BACKEND_URL };
