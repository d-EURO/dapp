import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWifi, faServer, faRefresh } from "@fortawesome/free-solid-svg-icons";

interface ApiErrorFallbackProps {
  error?: string;
  onRetry?: () => void;
  isLoading?: boolean;
}

export default function ApiErrorFallback({ 
  error = "Unable to connect to API", 
  onRetry,
  isLoading = false 
}: ApiErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
      <FontAwesomeIcon 
        icon={faServer} 
        className="w-12 h-12 text-yellow-600 dark:text-yellow-500 mb-4"
      />
      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
        API Connection Issue
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md mb-4">
        {error}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FontAwesomeIcon icon={faRefresh} className={isLoading ? "animate-spin" : ""} />
          {isLoading ? "Retrying..." : "Retry"}
        </button>
      )}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        <FontAwesomeIcon icon={faWifi} className="mr-1" />
        Check your internet connection
      </div>
    </div>
  );
}