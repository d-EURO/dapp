import { useState, useEffect, useCallback } from "react";
import axios, { AxiosError } from "axios";
import { CONFIG } from "../app.config";

interface UseApiWithFallbackOptions {
  url?: string;
  retryCount?: number;
  retryDelay?: number;
  fallbackData?: any;
  enabled?: boolean;
}

interface UseApiWithFallbackResult<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
  isOffline: boolean;
}

export function useApiWithFallback<T = any>({
  url,
  retryCount = 3,
  retryDelay = 1000,
  fallbackData = null,
  enabled = true,
}: UseApiWithFallbackOptions): UseApiWithFallbackResult<T> {
  const [data, setData] = useState<T | null>(fallbackData);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [attemptCount, setAttemptCount] = useState(0);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!url || !enabled) return;

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const response = await axios.get(url, {
        timeout: 10000, // 10 second timeout
        headers: {
          "Content-Type": "application/json",
        },
      });

      setData(response.data);
      setAttemptCount(0);
    } catch (err) {
      const axiosError = err as AxiosError;
      let errorMessage = "An unexpected error occurred";

      if (isOffline) {
        errorMessage = "You are currently offline. Please check your internet connection.";
      } else if (axiosError.code === "ECONNABORTED") {
        errorMessage = "Request timeout. The server took too long to respond.";
      } else if (axiosError.response) {
        // Server responded with error
        switch (axiosError.response.status) {
          case 404:
            errorMessage = "API endpoint not found. The service may be temporarily unavailable.";
            break;
          case 500:
          case 502:
          case 503:
            errorMessage = "Server error. Please try again later.";
            break;
          case 429:
            errorMessage = "Too many requests. Please wait a moment before trying again.";
            break;
          default:
            errorMessage = `Server error (${axiosError.response.status})`;
        }
      } else if (axiosError.request) {
        // Request made but no response
        errorMessage = "Cannot reach the server. Please check if the service is available.";
      }

      setError(errorMessage);
      setIsError(true);

      // Retry logic
      if (attemptCount < retryCount && !isOffline) {
        setTimeout(() => {
          setAttemptCount(prev => prev + 1);
          fetchData();
        }, retryDelay * (attemptCount + 1)); // Exponential backoff
      } else if (fallbackData) {
        // Use fallback data if available
        setData(fallbackData);
      }
    } finally {
      setIsLoading(false);
    }
  }, [url, enabled, isOffline, attemptCount, retryCount, retryDelay, fallbackData]);

  useEffect(() => {
    fetchData();
  }, [url, enabled]);

  const retry = useCallback(() => {
    setAttemptCount(0);
    fetchData();
  }, [fetchData]);

  return {
    data,
    error,
    isLoading,
    isError,
    retry,
    isOffline,
  };
}