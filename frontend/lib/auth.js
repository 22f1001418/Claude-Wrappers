import { getBackendUrl } from "./backend_url";
import { emitErrorToast, emitSuccessToast } from "./toast";

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export function clearAuthStoragePreserveTheme() {
  const savedTheme = localStorage.getItem("theme");
  localStorage.clear();

  if (savedTheme === "dark" || savedTheme === "light") {
    localStorage.setItem("theme", savedTheme);
  }
}

/**
 * Refresh the access token using the refresh token
 */
export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refresh_token");
  
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  try {
    const url = await getBackendUrl();
    const response = await fetch(`${url}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${refreshToken}`
      }
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const data = await response.json();
    localStorage.setItem("access_token", data.access_token);
    return data.access_token;
  } catch (error) {
    // Clear tokens and redirect to login
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw error;
  }
}

/**
 * Enhanced fetch that automatically handles token refresh on 401 errors
 */
export async function fetchWithAuth(url, options = {}) {
  const {
    suppressToast = false,
    suppressErrorToast = false,
    toastSuccessMessage,
    toastErrorMessage,
    ...fetchOptions
  } = options;
  const token = localStorage.getItem("access_token");
  
  // Add authorization header if token exists
  const authHeaders = token ? {
    "Authorization": `Bearer ${token}`
  } : {};

  const config = {
    ...fetchOptions,
    headers: {
      ...fetchOptions.headers,
      ...authHeaders
    }
  };

  const method = String(config.method || "GET").toUpperCase();
  const isMutatingMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const isLogoutEndpoint = String(url || "").includes("/api/auth/logout");

  // Make the initial request
  let response;
  try {
    response = await fetch(url, config);
  } catch (error) {
    if (!suppressErrorToast && isMutatingMethod) {
      emitErrorToast(toastErrorMessage || "Request failed. Please try again.");
    }
    throw error;
  }

  // If we get a 401, try to refresh the token
  if (response.status === 401) {
    if (isRefreshing) {
      // If already refreshing, queue this request
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(newToken => {
          config.headers["Authorization"] = `Bearer ${newToken}`;
          return fetch(url, config);
        })
        .catch(err => {
          return Promise.reject(err);
        });
    }

    isRefreshing = true;

    try {
      const newToken = await refreshAccessToken();
      isRefreshing = false;
      processQueue(null, newToken);

      // Retry the original request with new token
      config.headers["Authorization"] = `Bearer ${newToken}`;
      response = await fetch(url, config);
      return response;
    } catch (error) {
      isRefreshing = false;
      processQueue(error, null);
      throw error;
    }
  }

  if (!suppressToast && !isLogoutEndpoint && response.ok && isMutatingMethod) {
    try {
      const contentType = response.headers.get("content-type") || "";
      let message = toastSuccessMessage || "Action completed successfully";

      if (contentType.includes("application/json")) {
        const data = await response.clone().json();
        message = toastSuccessMessage || data?.message || data?.success_message || message;
      }

      emitSuccessToast(message);
    } catch (error) {
      // Ignore toast parsing errors to avoid interrupting request flows.
    }
  }

  if (!suppressErrorToast && !response.ok && isMutatingMethod) {
    try {
      const contentType = response.headers.get("content-type") || "";
      let errorMessage = toastErrorMessage || "Action failed. Please try again.";

      if (contentType.includes("application/json")) {
        const data = await response.clone().json();
        errorMessage = toastErrorMessage || data?.error || data?.message || errorMessage;
      }

      emitErrorToast(errorMessage);
    } catch (error) {
      emitErrorToast(toastErrorMessage || "Action failed. Please try again.");
    }
  }

  return response;
}

/**
 * Logout user and clear all tokens
 */
export function logout() {
  if (window.google?.accounts?.id?.disableAutoSelect) {
    window.google.accounts.id.disableAutoSelect();
  }

  clearAuthStoragePreserveTheme();
  window.location.href = "/login";
}
