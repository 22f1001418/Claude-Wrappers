"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "@/styles/cameraFeed.module.css";

const CameraFeed = () => {
  const videoRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    let stream = null;

    const startCamera = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Request camera access
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "environment", // Use back camera on mobile
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermission(true);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setError(
          err.name === "NotAllowedError"
            ? "Camera permission denied. Please allow camera access."
            : "Unable to access camera. Please check your device."
        );
        setIsLoading(false);
      }
    };

    startCamera();

    // Cleanup function
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className={styles.cameraContainer}>
      {isLoading && (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Starting camera...</p>
        </div>
      )}

      {error && (
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>📷</div>
          <p className={styles.errorMessage}>{error}</p>
          <button
            className={styles.retryButton}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`${styles.videoFeed} ${
          !hasPermission || error ? styles.hidden : ""
        }`}
      />

      {hasPermission && !error && (
        <div className={styles.cameraOverlay}>
          <div className={styles.statusIndicator}>
            <span className={styles.liveIndicator}></span>
            <span className={styles.liveText}>LIVE</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraFeed;
