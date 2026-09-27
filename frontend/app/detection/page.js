"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { io } from "socket.io-client";
import { getBackendUrl } from "@/lib/backend_url";
import BillTable from "../components/BillTable";
import DashboardNavbar from "../components/Navbar";
import DashboardSidebar from "../components/Sidebar";
import styles from "@/styles/detection.module.css";
import dashboardStyles from "@/styles/dashboard.module.css";
import { fetchWithAuth, clearAuthStoragePreserveTheme } from "@/lib/auth";
import { useSyncedTheme } from "@/lib/theme";

const DetectionPage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { darkMode, toggleTheme } = useSyncedTheme();
  const [detectedItems, setDetectedItems] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [backendUrl, setBackendUrl] = useState(null);
  const socketRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      router.replace("/login");
    }

    setLoading(false);
  }, [router]);

  const handleSignOut = useCallback(async () => {
    try {
      await fetchWithAuth("http://localhost:5001/api/auth/logout", {
        method: "POST",
      });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      clearAuthStoragePreserveTheme();
      router.replace("/login");
    }
  }, [router]);

  const handleProfileClick = useCallback(async () => {
    try {
      const res = await fetchWithAuth("http://localhost:5001/api/auth/profile", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        clearAuthStoragePreserveTheme();
        alert("Session expired. Please login again.");
        router.replace("/login");
        return;
      }

      router.push("/dashboard/profile");
    } catch (err) {
      console.error("Profile fetch error:", err);
      alert("Something went wrong");
    }
  }, [router]);

  // Resolve backend URL once on mount
  useEffect(() => {
    getBackendUrl().then(setBackendUrl);
  }, []);

  // Draw bounding boxes on the canvas overlay.
  // Coords are normalised 0-1 by the backend; we scale to the rendered <img> size.
  const drawBoxes = useCallback((boxes) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !boxes) return;
    const ctx = canvas.getContext("2d");
    const w = img.clientWidth;
    const h = img.clientHeight;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    boxes.forEach(({ x1, y1, x2, y2, label, color }) => {
      const bx = x1 * w, by = y1 * h;
      const bw = (x2 - x1) * w, bh = (y2 - y1) * h;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.font = "bold 12px sans-serif";
      const textW = ctx.measureText(label).width;
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = color;
      ctx.fillRect(bx, by - 22, textW + 10, 22);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, bx + 5, by - 6);
    });
  }, []);

  // Connect SocketIO once backendUrl is resolved
  useEffect(() => {
    if (!backendUrl) return;
    let cancelled = false;

    const socket = io(backendUrl, {
      transports: ["polling", "websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (cancelled) return;
      console.log("Connected to detection server");
      setIsDetecting(true);
      fetch(`${backendUrl}/api/yolo/start_camera`, { method: "POST" })
        .then((r) => r.json())
        .then((d) => { if (d.success) console.log("Camera started"); })
        .catch((e) => console.error("Failed to start camera:", e));
    });

    socket.on("detection_update", (data) => {
      if (cancelled) return;
      // Draw boxes on canvas — MJPEG <img> handles the actual video
      if (data.boxes) drawBoxes(data.boxes);
      if (data.bill_data) {
        setDetectedItems(data.bill_data.map((item) => ({
          product_name: item.item,
          class_name: item.class_name,
          brand: item.brand || "N/A",
          quantity: item.quantity,
          unit_price: item.price,
          subtotal: item.total,
        })));
      }
    });

    socket.on("disconnect", () => {
      setIsDetecting(false);
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setIsDetecting(false);
    });

    // Cleanup on unmount - stop camera and disconnect socket
    return () => {
      cancelled = true;
      
      // Stop the camera
      fetch(`${backendUrl}/api/yolo/stop_camera`, { method: "POST" })
        .then((r) => r.json())
        .then((d) => { if (d.success) console.log("Camera stopped"); })
        .catch((e) => console.error("Failed to stop camera:", e));
      
      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      
      // Clear canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [backendUrl, drawBoxes]);
    
      const handleCheckout = async (billData) => {
  try {
    if (!billData || billData.length === 0) {
      alert("No items detected!");
      return;
    }

    setNotification({ type: "loading", message: "Processing sale..." });

    const url = await getBackendUrl();

    const response = await fetch(`${url}/api/yolo/sales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: billData,
        customer_name: "Smart Cart Customer",
        payment_method: "cash",
      }),
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem("detected_bill", JSON.stringify(
        billData.map(item => ({
          product_name: item.product_name || item.item,
          units: item.quantity,
          unit_price: item.unit_price || item.price,
          product_id: null
        }))
      ));

      router.push("/billing");

      return;
    }

  } catch (error) {
    console.error("Checkout error:", error);

    setNotification({
      type: "error",
      message: error.message || "Failed to complete sale",
    });

    setTimeout(() => {
      setNotification(null);
    }, 3000);
  }
};

  const handleRemoveItem = async (class_name) => {
    try {
      const url = await getBackendUrl();
      const response = await fetch(`${url}/api/yolo/remove_item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_name }),
      });
      const data = await response.json();
      if (!data.success) console.error('Failed to remove item:', data.error);
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  const handleClearBill = async () => {
    try {
        const url = await getBackendUrl();
        const response = await fetch(`${url}/api/yolo/clear_bill`, {
            method: 'POST',
        });
        const data = await response.json();
        if (data.success) {
            setDetectedItems([]);
            setNotification({ type: "success", message: "Bill cleared" });
            setTimeout(() => setNotification(null), 2000);
        }
    } catch (error) {
        console.error('Failed to clear bill:', error);
    }
  };

  if (loading) return null;
  if (!user) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <DashboardNavbar 
        darkMode={darkMode} 
        toggleTheme={toggleTheme} 
        handleProfileClick={handleProfileClick}
        user={user}
      />

      {/* CONTENT AREA - Sidebar + Main */}
      <div style={{ display: "flex", marginTop: "70px" }}>
        <DashboardSidebar 
          darkMode={darkMode} 
          user={user} 
          handleSignOut={handleSignOut} 
          handleProfileClick={handleProfileClick} 
        />

        {/* MAIN CONTENT - DETECTION PAGE */}
        <div
          style={{
            marginLeft: "250px",
            flex: 1,
            padding: "40px",
            background: darkMode ? "#0a0a0a" : "#faf8f5",
            minHeight: "calc(100vh - 70px)",
            transition: "all 0.3s ease",
          }}
        >
          {/* Detection Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "30px"
          }}>
            <h2 style={{ 
              color: darkMode ? '#ffffff' : '#1a4a52',
              margin: 0
            }}>Smart Cart Detection</h2>
            
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px"
            }}>

            {/* 🟢 DETECTING STATUS  */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "14px",
              fontWeight: "500",
              color: isDetecting ? "#22c55e" : "#94a3b8",
            }}>
              <span style={{
                width: "8px",
                height: "8px",
                background: isDetecting ? "#22c55e" : "#94a3b8",
                borderRadius: "50%",
                animation: isDetecting ? "pulse 2s ease-in-out infinite" : "none",
              }}></span>

              <span>{isDetecting ? "Detecting..." : "Inactive"}</span>
            </div>

            {/* 🔘 BUTTONS (EXTREME RIGHT) */}
            <div style={{
              display: "flex",
              marginLeft: "auto",   // 🔥 THIS pushes buttons to extreme right
              background: "var(--card-bg)",
              border: "1px solid var(--border-color)",
              padding: "6px",
              borderRadius: "14px",
              gap: "8px",
            }}>

              <button
                onClick={() => router.push("/detection")}
                className="mode-toggle-active"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 18px",
                  borderRadius: "10px",
                  background: darkMode ? "rgba(212, 165, 73, 0.18)" : "var(--accent-gradient)",
                  color: "#fff",
                  border: darkMode ? "1px solid rgba(212, 165, 73, 0.55)" : "1px solid transparent",
                  boxShadow: darkMode ? "0 0 0 1px rgba(212, 165, 73, 0.18)" : "none",
                  fontSize: "14px",
                  fontWeight: "600",
                  lineHeight: 1,
                  cursor: "pointer"
                }}
              >
                <Image
                  src="/vectors/smart_cart_detection.png"
                  alt="Smart Cart Detection"
                  width={25}
                  height={25}
                  style={{ objectFit: "contain", filter: "brightness(0) invert(1)" }}
                />
                <span>Smart Cart Detection</span>
              </button>

              <button
                onClick={() => router.push("/billing")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 18px",
                  borderRadius: "10px",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  fontSize: "14px",
                  fontWeight: "600",
                  lineHeight: 1,
                  cursor: "pointer"
                }}
              >
                <Image
                  src="/vectors/new_manual_billing.png"
                  alt="Manual Billing"
                  width={25}
                  height={25}
                  style={{ objectFit: "contain", filter: "brightness(0) saturate(100%)" }}
                />
                <span>Manual Billing</span>
              </button>
            </div>
          </div>
        </div>
          {/* Detection Content */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 380px",
            gap: "1.5rem",
            height: "calc(100vh - 200px)",
          }}>
            {/* Camera Section */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              background: "#000",
              borderRadius: "12px",
              minHeight: 0,
              position: "relative",
              aspectRatio: "16 / 9",
              maxHeight: "100%",
            }}>
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                {backendUrl ? (
                  <img
                    ref={imgRef}
                    src={`${backendUrl}/api/yolo/video_feed`}
                    alt="Live Detection Feed"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: "12px",
                      background: "#000",
                      display: "block",
                    }}
                  />
                ) : (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "100%", height: "100%", background: "#000",
                    borderRadius: "12px", color: "#fff",
                  }}>
                    <p>Connecting to camera...</p>
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  style={{
                    position: "absolute", top: 0, left: 0,
                    width: "100%", height: "100%",
                    pointerEvents: "none", borderRadius: "12px",
                  }}
                />
              </div>
            </div>

            {/* Bill Section */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}>
              <BillTable
                detectedItems={detectedItems}
                onCheckout={handleCheckout}
                onRemoveItem={handleRemoveItem}
                onClearBill={handleClearBill}
                darkMode={darkMode}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          style={{
            position: "fixed",
            bottom: "2rem",
            right: "2rem",
            padding: "1rem 1.5rem",
            borderRadius: "12px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            fontWeight: "500",
            animation: "slideUp 0.3s ease",
            zIndex: 1000,
            backdropFilter: "blur(8px)",
            background: notification.type === "loading" ? "rgba(59, 130, 246, 0.95)" : notification.type === "success" ? "rgba(16, 185, 129, 0.95)" : "rgba(239, 68, 68, 0.95)",
            color: "white",
          }}
        >
          {notification.type === "loading" && (
            <div style={{
              width: "20px",
              height: "20px",
              border: "2px solid rgba(255, 255, 255, 0.3)",
              borderTopColor: "white",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}></div>
          )}
          {notification.type === "success" && <span>✓</span>}
          {notification.type === "error" && <span>✗</span>}
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default DetectionPage;
