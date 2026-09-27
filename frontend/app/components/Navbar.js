"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dashboardStyles from "@/styles/dashboard.module.css";
import { fetchWithAuth, clearAuthStoragePreserveTheme } from "@/lib/auth";
import { getBackendUrl } from "@/lib/backend_url";

const DashboardNavbar = ({ darkMode, toggleTheme, handleProfileClick, user }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const notificationsRef = useRef(null);
  const router = useRouter();

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const backendUrl = await getBackendUrl();
      const response = await fetchWithAuth(`${backendUrl}/api/notifications?limit=20`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (!response.ok) return;

      setNotifications(data?.notifications || []);
      setUnreadCount(Number(data?.unread_count || 0));
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  };

  const markNotificationRead = async (notificationId) => {
    try {
      const backendUrl = await getBackendUrl();
      const response = await fetchWithAuth(`${backendUrl}/api/notifications/${notificationId}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        suppressToast: true,
      });

      if (!response.ok) return;

      setNotifications((prev) => prev.map((item) => (
        item.notification_id === notificationId ? { ...item, is_read: true } : item
      )));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const dismissNotification = async (notificationId) => {
    const notification = notifications.find((n) => n.notification_id === notificationId);
    try {
      const backendUrl = await getBackendUrl();
      const response = await fetchWithAuth(`${backendUrl}/api/notifications/${notificationId}/dismiss`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        suppressToast: true,
      });

      if (!response.ok) return;

      setNotifications((prev) => prev.filter((item) => item.notification_id !== notificationId));
      if (notification && !notification.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to dismiss notification:", error);
    }
  };

  const dismissAllNotifications = async () => {
    try {
      const backendUrl = await getBackendUrl();
      const response = await fetchWithAuth(`${backendUrl}/api/notifications/dismiss-all`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        suppressToast: true,
      });

      if (!response.ok) return;

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to dismiss all notifications:", error);
    }
  };

  const formatNotificationTime = (isoDate) => {
    if (!isoDate) return "";
    const value = new Date(isoDate);
    if (Number.isNaN(value.getTime())) return "";
    return value.toLocaleString();
  };

  useEffect(() => {
    if (!user) return;

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }

      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };

    if (isDropdownOpen || isNotificationsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen, isNotificationsOpen]);

  const handleDropdownItemClick = (action) => {
    setIsDropdownOpen(false);
    if (action === "profile") {
      router.push("/profile");
    } else if (action === "cashiers") {
      router.push("/cashiers");
    } else if (action === "admins") {
      router.push("/admins");
    } else if (action === "notes") {
      router.push("/notes");
    } else if (action === "settings") {
      router.push("/settings");
    } else if (action === "restart-tour") {
      window.dispatchEvent(new CustomEvent("owner-tour-start"));
    } else if (action === "signout") {
      clearAuthStoragePreserveTheme();
      router.replace("/login");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        width: "100%",
        height: "70px",
        background: darkMode ? "#121212" : "#ffffff",
        display: "flex",
        alignItems: "center",
        padding: "0 30px",
        boxShadow: darkMode ? "0 2px 10px rgba(0, 0, 0, 0.5)" : "0 2px 10px rgba(0, 0, 0, 0.1)",
        zIndex: 1000,
        transition: "all 0.3s ease",
        gap: "20px"
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", minWidth: "140px" }} aria-label="Go to homepage">
        <Image
          src="/vectors/VyapaarAI (Transparent BG).png"
          alt="VyapaarAI Logo"
          width={140}
          height={50}
          style={{ 
            objectFit: "contain",
            filter: darkMode ? "brightness(0) invert(1)" : "none",
            transition: "filter 0.3s ease"
          }}
        />
      </Link>

      <div style={{ flex: 1 }}></div>

      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "12px"
      }}>
        <button
          className="navbar-control-btn"
          onClick={() => {
            const next = !isNotificationsOpen;
            setIsNotificationsOpen(next);
            if (next) {
              fetchNotifications();
            }
          }}
          style={{
            position: "relative",
            border: "none",
            cursor: "pointer",
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: darkMode ? "#ffffff" : "#1a4a52",
            background: darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(44, 110, 126, 0.1)",
            border: darkMode ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(44, 110, 126, 0.15)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(44, 110, 126, 0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(44, 110, 126, 0.1)";
          }}
          title="Notifications"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"></path>
            <path d="M9 17a3 3 0 0 0 6 0"></path>
          </svg>
          {unreadCount > 0 && (
            <span style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              minWidth: "18px",
              height: "18px",
              borderRadius: "999px",
              background: "#dc2626",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 5px",
            }}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {isNotificationsOpen && (
          <div ref={notificationsRef} style={{
            position: "absolute",
            top: "64px",
            right: "84px",
            width: "380px",
            maxHeight: "460px",
            overflowY: "auto",
            background: darkMode ? "#171717" : "#ffffff",
            borderRadius: "12px",
            boxShadow: darkMode ? "0 8px 24px rgba(0,0,0,0.55)" : "0 8px 24px rgba(0,0,0,0.18)",
            border: darkMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(44,110,126,0.16)",
            zIndex: 2100,
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(44,110,126,0.12)",
            }}>
              <span style={{ color: darkMode ? "#ffffff" : "#1a4a52", fontSize: "15px", fontWeight: "700" }}>
                Notifications
              </span>
              {notifications.length > 0 && (
                <button
                  onClick={dismissAllNotifications}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: darkMode ? "#f0c979" : "#9a7a27",
                    fontSize: "12px",
                    fontWeight: "700",
                  }}
                >
                  Dismiss all
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div style={{
                padding: "18px 14px",
                color: darkMode ? "rgba(255,255,255,0.65)" : "rgba(26,74,82,0.7)",
                fontSize: "14px",
              }}>
                No notifications right now.
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.notification_id}
                  onClick={() => {
                    if (!item.is_read) {
                      markNotificationRead(item.notification_id);
                    }
                  }}
                  style={{
                    padding: "12px 14px",
                    borderBottom: darkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(44,110,126,0.08)",
                    background: item.is_read
                      ? "transparent"
                      : darkMode
                        ? "rgba(212,165,73,0.08)"
                        : "rgba(212,165,73,0.09)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                    <div style={{ color: darkMode ? "#ffffff" : "#1a4a52", fontSize: "14px", fontWeight: item.is_read ? "600" : "700" }}>
                      {item.title}
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        dismissNotification(item.notification_id);
                      }}
                      title="Dismiss"
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: darkMode ? "rgba(255,255,255,0.65)" : "rgba(26,74,82,0.65)",
                        fontSize: "16px",
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      x
                    </button>
                  </div>
                  <div style={{
                    color: darkMode ? "rgba(255,255,255,0.8)" : "rgba(26,74,82,0.8)",
                    fontSize: "13px",
                    marginTop: "4px",
                    lineHeight: 1.4,
                  }}>
                    {item.message}
                  </div>
                  <div style={{
                    color: darkMode ? "rgba(255,255,255,0.55)" : "rgba(26,74,82,0.55)",
                    fontSize: "11px",
                    marginTop: "6px",
                  }}>
                    {formatNotificationTime(item.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <button
          onClick={toggleTheme}
          className={`navbar-control-btn ${dashboardStyles.themeToggle}`}
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            color: darkMode ? "#ffffff" : "#1a4a52",
            background: darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(44, 110, 126, 0.1)",
            border: darkMode ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(44, 110, 126, 0.15)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(44, 110, 126, 0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(44, 110, 126, 0.1)";
          }}
        >
          {darkMode ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2.5V4M10 16V17.5M4 10H2.5M17.5 10H16M15.364 15.364L14.303 14.303M5.636 5.636L4.575 4.575M15.364 4.636L14.303 5.697M5.636 14.364L4.575 15.425M13 10C13 11.657 11.657 13 10 13C8.343 13 7 11.657 7 10C7 8.343 8.343 7 10 7C11.657 7 13 8.343 13 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M17.5 11.5C16.537 12.125 15.392 12.5 14.167 12.5C10.945 12.5 8.333 9.888 8.333 6.667C8.333 5.442 8.708 4.297 9.333 3.333C5.833 3.958 3.333 7.042 3.333 10.667C3.333 14.717 6.617 18 10.667 18C14.292 18 17.375 15.5 18 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div style={{ position: "relative" }} ref={dropdownRef}>
          <div
            style={{
              cursor: "pointer",
              color: darkMode ? "#ffffff" : "#1a4a52",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "8px",
              background: darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(44, 110, 126, 0.1)",
              border: darkMode ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(44, 110, 126, 0.15)",
            }}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(44, 110, 126, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(44, 110, 126, 0.1)";
            }}
          >
            <Image
              src="/vectors/profile.png"
              alt="Profile"
              width={20}
              height={20}
              style={{
                filter: darkMode ? "brightness(0) invert(1)" : "none",
                transition: "filter 0.3s ease"
              }}
            />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ 
                transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease" 
              }}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              background: darkMode ? "#1a1a1a" : "#ffffff",
              borderRadius: "8px",
              boxShadow: darkMode 
                ? "0 4px 12px rgba(0, 0, 0, 0.6)" 
                : "0 4px 12px rgba(0, 0, 0, 0.15)",
              border: darkMode 
                ? "1px solid rgba(255, 255, 255, 0.1)" 
                : "1px solid rgba(44, 110, 126, 0.15)",
              minWidth: "180px",
              padding: "8px 0",
              zIndex: 2000,
            }}>
              {/* My Profile - shown for all roles */}
              <div
                onClick={() => handleDropdownItemClick("profile")}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  color: darkMode ? "#ffffff" : "#1a4a52",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = darkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(44, 110, 126, 0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                My Profile
              </div>

              {/* Cashiers - only for owner/user */}
              {(user?.role === "owner" || user?.role === "user") && (
                <div
                  onClick={() => handleDropdownItemClick("cashiers")}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    fontWeight: "500",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = darkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(44, 110, 126, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Manage Cashiers
                </div>
              )}

              {/* All Admins - only for admin */}
              {user?.role === "admin" && (
                <div
                  onClick={() => handleDropdownItemClick("admins")}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    fontWeight: "500",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = darkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(44, 110, 126, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  All Admins
                </div>
              )}

              {/* My Notes - only for owner/user */}
              {/* {(user?.role === "owner" || user?.role === "user") && (
                <div
                  onClick={() => handleDropdownItemClick("notes")}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    fontWeight: "500",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = darkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(44, 110, 126, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  My Notes
                </div>
              )} */}

              {/* Setting/Settings - shown for all roles (admin gets "Settings" plural) */}
              <div
                onClick={() => handleDropdownItemClick("settings")}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  color: darkMode ? "#ffffff" : "#1a4a52",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = darkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(44, 110, 126, 0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {user?.role === "admin" ? "Settings" : "Settings"}
              </div>

              {(user?.role === "owner" || user?.role === "user") && (
                <div
                  onClick={() => handleDropdownItemClick("restart-tour")}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    fontWeight: "500",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = darkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(44, 110, 126, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Show Tour Again
                </div>
              )}

              <div 
                style={{
                  height: "1px",
                  background: darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(44, 110, 126, 0.15)",
                  margin: "8px 0"
                }}
              />

              {/* Sign Out - shown for all roles */}
              <div
                onClick={() => handleDropdownItemClick("signout")}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  color: "#dc2626",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = darkMode ? "rgba(220, 38, 38, 0.1)" : "rgba(220, 38, 38, 0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                Sign Out
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(DashboardNavbar);
