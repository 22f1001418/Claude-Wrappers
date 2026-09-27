"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import DashboardNavbar from "@/app/components/Navbar";
import DashboardSidebar from "@/app/components/Sidebar";
import { fetchWithAuth, clearAuthStoragePreserveTheme } from "@/lib/auth";
import { getBackendUrl } from "@/lib/backend_url";
import { useSyncedTheme } from "@/lib/theme";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { darkMode, toggleTheme } = useSyncedTheme();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [showExportDurationModal, setShowExportDurationModal] = useState(false);
  const [exportDuration, setExportDuration] = useState("1m");
  const [dailyReportEnabled, setDailyReportEnabled] = useState(true);
  const [workspaceRemindersEnabled, setWorkspaceRemindersEnabled] = useState(true);
  const [creditRemindersEnabled, setCreditRemindersEnabled] = useState(true);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const [dailyReportDayMode, setDailyReportDayMode] = useState("same_day");
  const [dailyReportTime, setDailyReportTime] = useState("20:30");
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [isUpdatingLowStockThreshold, setIsUpdatingLowStockThreshold] = useState(false);

  const exportDurationOptions = [
    { value: "1m", label: "Past 1 month" },
    { value: "3m", label: "Past 3 months" },
    { value: "6m", label: "Past 6 months" },
    { value: "12m", label: "Past 12 months (1 year)" },
    { value: "all", label: "All Time" },
  ];

  const defaultAllowedReportTimes = {
    same_day: ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00"],
    next_day: ["06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30"],
  };
  const [allowedReportTimes, setAllowedReportTimes] = useState(defaultAllowedReportTimes);
  const isShopOwner = user?.role === "owner" || user?.role === "user";

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
    } else {
      router.replace("/login");
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    const loadNotificationSettings = async () => {
      if (!user) return;
      if (!(user.role === "owner" || user.role === "user")) return;
      try {
        const backendUrl = await getBackendUrl();
        const response = await fetchWithAuth(`${backendUrl}/api/settings/notifications`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();
        if (response.ok) {
          const incomingTimes = data?.allowed_report_times;
          const sameDayTimes = Array.isArray(incomingTimes?.same_day) && incomingTimes.same_day.length
            ? incomingTimes.same_day
            : defaultAllowedReportTimes.same_day;
          const nextDayTimes = Array.isArray(incomingTimes?.next_day) && incomingTimes.next_day.length
            ? incomingTimes.next_day
            : defaultAllowedReportTimes.next_day;
          setAllowedReportTimes({ same_day: sameDayTimes, next_day: nextDayTimes });

          setDailyReportEnabled(data.daily_report_enabled);
          setWorkspaceRemindersEnabled(typeof data?.workspace_reminders_enabled === "boolean" ? data.workspace_reminders_enabled : true);
          setCreditRemindersEnabled(typeof data?.credit_reminders_enabled === "boolean" ? data.credit_reminders_enabled : true);
          const mode = data?.daily_report_day_mode === "next_day" ? "next_day" : "same_day";
          setDailyReportDayMode(mode);

          const safeTimes = mode === "next_day" ? nextDayTimes : sameDayTimes;
          const safeTime = safeTimes.includes(data?.daily_report_time) ? data.daily_report_time : safeTimes[0];
          setDailyReportTime(safeTime);
          const thresholdValue = Number(data?.low_stock_threshold);
          setLowStockThreshold(Number.isFinite(thresholdValue) ? thresholdValue : 10);
        }
      } catch (error) {
        console.error("Failed to load notification settings:", error);
      }
    };

    loadNotificationSettings();
  }, [user]);

  const handleSignOut = () => {
    clearAuthStoragePreserveTheme();
    router.replace("/login");
  };

  const handleProfileClick = async () => {
    router.push("/profile");
  };

  const handleExportData = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      const backendUrl = await getBackendUrl();
      const response = await fetchWithAuth(`${backendUrl}/api/settings/export-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ duration: exportDuration }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Failed to queue export job");
      }

      const taskMessage = data?.task_id
        ? `Export started. Task ID: ${data.task_id}`
        : "Export started.";

      setShowExportDurationModal(false);
      alert(`${taskMessage} Duration: ${data?.duration || exportDuration}. You will receive an email when your file is ready.`);
    } catch (error) {
      console.error("Error exporting data:", error);
      alert(error.message || "Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== user?.username) {
      alert("Username doesn't match. Please type your username correctly.");
      return;
    }

    try {
      // TODO: Implement delete account API call
      const confirmDelete = window.confirm(
        "Are you absolutely sure? This action cannot be undone!"
      );
      
      if (confirmDelete) {
        // API call to delete account would go here
        alert("Account deletion functionality will be implemented soon!");
        console.log("Deleting account...");
        // After successful deletion:
        // localStorage.clear();
        // router.replace("/login");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Failed to delete account");
    } finally {
      setShowDeleteConfirm(false);
      setDeleteInput("");
    }
  };

  const handleDailyReportToggle = async (enabled) => {
    if (isUpdatingNotifications) return;

    const previous = dailyReportEnabled;
    setDailyReportEnabled(enabled);
    setIsUpdatingNotifications(true);

    try {
      const backendUrl = await getBackendUrl();
      const response = await fetchWithAuth(`${backendUrl}/api/settings/notifications`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          daily_report_enabled: enabled,
          workspace_reminders_enabled: workspaceRemindersEnabled,
          credit_reminders_enabled: creditRemindersEnabled,
          daily_report_day_mode: dailyReportDayMode,
          daily_report_time: dailyReportTime,
          low_stock_threshold: lowStockThreshold,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update notification settings");
      }
    } catch (error) {
      setDailyReportEnabled(previous);
      console.error("Failed to update daily report setting:", error);
      alert(error.message || "Could not update daily report setting");
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  const handleReportModeChange = async (mode) => {
    if (isUpdatingNotifications) return;

    const previousMode = dailyReportDayMode;
    const previousTime = dailyReportTime;
    const nextTime = allowedReportTimes[mode][0];

    setDailyReportDayMode(mode);
    setDailyReportTime(nextTime);
    setIsUpdatingNotifications(true);

    try {
      const backendUrl = await getBackendUrl();
      const response = await fetchWithAuth(`${backendUrl}/api/settings/notifications`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          daily_report_enabled: dailyReportEnabled,
          workspace_reminders_enabled: workspaceRemindersEnabled,
          credit_reminders_enabled: creditRemindersEnabled,
          daily_report_day_mode: mode,
          daily_report_time: nextTime,
          low_stock_threshold: lowStockThreshold,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update daily report mode");
      }
    } catch (error) {
      setDailyReportDayMode(previousMode);
      setDailyReportTime(previousTime);
      console.error("Failed to update daily report mode:", error);
      alert(error.message || "Could not update report mode");
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  const handleReportTimeChange = async (time) => {
    if (isUpdatingNotifications) return;

    const previousTime = dailyReportTime;
    setDailyReportTime(time);
    setIsUpdatingNotifications(true);

    try {
      const backendUrl = await getBackendUrl();
      const response = await fetchWithAuth(`${backendUrl}/api/settings/notifications`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          daily_report_enabled: dailyReportEnabled,
          workspace_reminders_enabled: workspaceRemindersEnabled,
          credit_reminders_enabled: creditRemindersEnabled,
          daily_report_day_mode: dailyReportDayMode,
          daily_report_time: time,
          low_stock_threshold: lowStockThreshold,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update report time");
      }
    } catch (error) {
      setDailyReportTime(previousTime);
      console.error("Failed to update report time:", error);
      alert(error.message || "Could not update report time");
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  const handleSaveLowStockThreshold = async () => {
    if (isUpdatingNotifications || isUpdatingLowStockThreshold) return;

    const normalizedThreshold = Math.max(1, Math.min(200, Number(lowStockThreshold) || 10));
    const previousThreshold = lowStockThreshold;
    setLowStockThreshold(normalizedThreshold);
    setIsUpdatingLowStockThreshold(true);

    try {
      const backendUrl = await getBackendUrl();
      const response = await fetchWithAuth(`${backendUrl}/api/settings/notifications`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          daily_report_enabled: dailyReportEnabled,
          workspace_reminders_enabled: workspaceRemindersEnabled,
          credit_reminders_enabled: creditRemindersEnabled,
          daily_report_day_mode: dailyReportDayMode,
          daily_report_time: dailyReportTime,
          low_stock_threshold: normalizedThreshold,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update low stock threshold");
      }

      if (typeof data?.low_stock_threshold === "number") {
        setLowStockThreshold(data.low_stock_threshold);
      }
    } catch (error) {
      setLowStockThreshold(previousThreshold);
      console.error("Failed to update low stock threshold:", error);
      alert(error.message || "Could not update low stock threshold");
    } finally {
      setIsUpdatingLowStockThreshold(false);
    }
  };

  const handleWorkspaceRemindersToggle = async (enabled) => {
    if (isUpdatingNotifications || isUpdatingLowStockThreshold) return;

    const previous = workspaceRemindersEnabled;
    setWorkspaceRemindersEnabled(enabled);
    setIsUpdatingNotifications(true);

    try {
      const backendUrl = await getBackendUrl();
      const response = await fetchWithAuth(`${backendUrl}/api/settings/notifications`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          daily_report_enabled: dailyReportEnabled,
          workspace_reminders_enabled: enabled,
          credit_reminders_enabled: creditRemindersEnabled,
          daily_report_day_mode: dailyReportDayMode,
          daily_report_time: dailyReportTime,
          low_stock_threshold: lowStockThreshold,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update workspace reminders");
      }
    } catch (error) {
      setWorkspaceRemindersEnabled(previous);
      console.error("Failed to update workspace reminders:", error);
      alert(error.message || "Could not update workspace reminders setting");
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  const handleCreditRemindersToggle = async (enabled) => {
    if (isUpdatingNotifications || isUpdatingLowStockThreshold) return;

    const previous = creditRemindersEnabled;
    setCreditRemindersEnabled(enabled);
    setIsUpdatingNotifications(true);

    try {
      const backendUrl = await getBackendUrl();
      const response = await fetchWithAuth(`${backendUrl}/api/settings/notifications`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          daily_report_enabled: dailyReportEnabled,
          workspace_reminders_enabled: workspaceRemindersEnabled,
          credit_reminders_enabled: enabled,
          daily_report_day_mode: dailyReportDayMode,
          daily_report_time: dailyReportTime,
          low_stock_threshold: lowStockThreshold,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update credit reminders");
      }
    } catch (error) {
      setCreditRemindersEnabled(previous);
      console.error("Failed to update credit reminders:", error);
      alert(error.message || "Could not update credit reminders setting");
    } finally {
      setIsUpdatingNotifications(false);
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

        {/* MAIN CONTENT */}
        <div style={{ 
          marginLeft: "250px",
          flex: 1,
          padding: "40px",
          minHeight: "calc(100vh - 70px)",
          background: darkMode ? '#0a0a0a' : '#faf8f5',
        }}>
          <div style={{
            maxWidth: "1200px",
            margin: "0 auto"
          }}>
            {/* Page Title */}
            <h1 style={{
              color: darkMode ? "#ffffff" : "#1a4a52",
              fontSize: "28px",
              fontWeight: "600",
              marginBottom: "30px"
            }}>
              Settings
            </h1>

            {/* Data Management Section */}
            <div style={{
              background: darkMode ? "#1a1a1a" : "#ffffff",
              borderRadius: "12px",
              padding: "30px",
              boxShadow: darkMode 
                ? "0 4px 12px rgba(0, 0, 0, 0.5)" 
                : "0 4px 12px rgba(0, 0, 0, 0.1)",
              border: darkMode 
                ? "1px solid rgba(255, 255, 255, 0.1)" 
                : "1px solid rgba(44, 110, 126, 0.15)",
              marginBottom: "30px"
            }}>
              <h3 style={{
                color: darkMode ? "#ffffff" : "#1a4a52",
                fontSize: "20px",
                fontWeight: "600",
                marginBottom: "8px"
              }}>
                Data Management
              </h3>
              <p style={{
                color: darkMode ? "rgba(255, 255, 255, 0.6)" : "rgba(26, 74, 82, 0.6)",
                fontSize: "14px",
                marginBottom: "24px"
              }}>
                Export your data or manage your account information
              </p>

              {/* Export Data Option */}
              <div style={{
                padding: "20px",
                borderRadius: "8px",
                background: darkMode ? "rgba(255, 255, 255, 0.03)" : "rgba(44, 110, 126, 0.03)",
                border: darkMode 
                  ? "1px solid rgba(255, 255, 255, 0.08)" 
                  : "1px solid rgba(44, 110, 126, 0.1)",
                marginBottom: "16px"
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div>
                    <h4 style={{
                      color: darkMode ? "#ffffff" : "#1a4a52",
                      fontSize: "16px",
                      fontWeight: "600",
                      marginBottom: "4px"
                    }}>
                      Export Your Data
                    </h4>
                    <p style={{
                      color: darkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(26, 74, 82, 0.5)",
                      fontSize: "14px",
                      margin: 0
                    }}>
                      Download a copy of all your account data
                    </p>
                  </div>
                  <button
                    onClick={() => setShowExportDurationModal(true)}
                    disabled={isExporting}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "none",
                      background: darkMode 
                        ? "rgba(212, 165, 73, 0.2)" 
                        : "rgba(212, 165, 73, 0.15)",
                      color: darkMode ? "#d4a549" : "#b8932f",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: isExporting ? "not-allowed" : "pointer",
                      opacity: isExporting ? 0.7 : 1,
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                    onMouseEnter={(e) => {
                      if (isExporting) return;
                      e.currentTarget.style.background = darkMode 
                        ? "rgba(212, 165, 73, 0.3)" 
                        : "rgba(212, 165, 73, 0.25)";
                    }}
                    onMouseLeave={(e) => {
                      if (isExporting) return;
                      e.currentTarget.style.background = darkMode 
                        ? "rgba(212, 165, 73, 0.2)" 
                        : "rgba(212, 165, 73, 0.15)";
                    }}
                  >
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    {isExporting ? "Starting Export..." : "Export Data"}
                  </button>
                </div>
              </div>
            </div>

            {/* Notifications Section */}
            {isShopOwner && (
            <div style={{
              background: darkMode ? "#1a1a1a" : "#ffffff",
              borderRadius: "12px",
              padding: "30px",
              boxShadow: darkMode
                ? "0 4px 12px rgba(0, 0, 0, 0.5)"
                : "0 4px 12px rgba(0, 0, 0, 0.1)",
              border: darkMode
                ? "1px solid rgba(255, 255, 255, 0.1)"
                : "1px solid rgba(44, 110, 126, 0.15)",
              marginBottom: "30px"
            }}>
              <h3 style={{
                color: darkMode ? "#ffffff" : "#1a4a52",
                fontSize: "20px",
                fontWeight: "600",
                marginBottom: "8px"
              }}>
                Notifications
              </h3>
              <p style={{
                color: darkMode ? "rgba(255, 255, 255, 0.6)" : "rgba(26, 74, 82, 0.6)",
                fontSize: "14px",
                marginBottom: "24px"
              }}>
                Control scheduled email notifications for your account.
              </p>

              <div style={{
                padding: "20px",
                borderRadius: "8px",
                background: darkMode ? "rgba(255, 255, 255, 0.03)" : "rgba(44, 110, 126, 0.03)",
                border: darkMode
                  ? "1px solid rgba(255, 255, 255, 0.08)"
                  : "1px solid rgba(44, 110, 126, 0.1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px"
              }}>
                <div>
                  <h4 style={{
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "16px",
                    fontWeight: "600",
                    marginBottom: "4px"
                  }}>
                    Daily Business Report
                  </h4>
                  <p style={{
                    color: darkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(26, 74, 82, 0.5)",
                    fontSize: "14px",
                    marginBottom: "14px"
                  }}>
                    Receive a beautiful daily HTML email with sales, collections, credit, top products, and inventory highlights.
                  </p>

                  <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: isUpdatingNotifications ? "not-allowed" : "pointer" }}>
                      <input
                        type="radio"
                        name="daily-report-mode"
                        checked={dailyReportDayMode === "same_day"}
                        disabled={isUpdatingNotifications}
                        onChange={() => handleReportModeChange("same_day")}
                      />
                      <span style={{ color: darkMode ? "#ffffff" : "#1a4a52", fontSize: "14px" }}>Same day</span>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: isUpdatingNotifications ? "not-allowed" : "pointer" }}>
                      <input
                        type="radio"
                        name="daily-report-mode"
                        checked={dailyReportDayMode === "next_day"}
                        disabled={isUpdatingNotifications}
                        onChange={() => handleReportModeChange("next_day")}
                      />
                      <span style={{ color: darkMode ? "#ffffff" : "#1a4a52", fontSize: "14px" }}>Next day</span>
                    </label>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ color: darkMode ? "rgba(255,255,255,0.7)" : "rgba(26,74,82,0.75)", fontSize: "13px" }}>Report time</span>
                    <select
                      value={dailyReportTime}
                      disabled={isUpdatingNotifications}
                      onChange={(e) => handleReportTimeChange(e.target.value)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: darkMode ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(44,110,126,0.25)",
                        background: darkMode ? "rgba(255,255,255,0.06)" : "#ffffff",
                        color: darkMode ? "#ffffff" : "#1a4a52",
                        fontSize: "13px",
                      }}
                    >
                      {(allowedReportTimes[dailyReportDayMode] || []).map((time) => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: isUpdatingNotifications ? "not-allowed" : "pointer" }}>
                  <input
                    type="checkbox"
                    checked={dailyReportEnabled}
                    disabled={isUpdatingNotifications}
                    onChange={(e) => handleDailyReportToggle(e.target.checked)}
                    style={{ width: "18px", height: "18px", cursor: isUpdatingNotifications ? "not-allowed" : "pointer" }}
                  />
                  <span style={{ color: darkMode ? "#ffffff" : "#1a4a52", fontSize: "14px", fontWeight: "600", minWidth: "72px" }}>
                    {dailyReportEnabled ? "Enabled" : "Disabled"}
                  </span>
                </label>
              </div>

              <div style={{
                padding: "20px",
                borderRadius: "8px",
                background: darkMode ? "rgba(255, 255, 255, 0.03)" : "rgba(44, 110, 126, 0.03)",
                border: darkMode
                  ? "1px solid rgba(255, 255, 255, 0.08)"
                  : "1px solid rgba(44, 110, 126, 0.1)",
                marginTop: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "16px"
              }}>
                <div>
                  <h4 style={{
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "16px",
                    fontWeight: "600",
                    marginBottom: "4px"
                  }}>
                    Workspace Reminders
                  </h4>
                  <p style={{
                    color: darkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(26, 74, 82, 0.5)",
                    fontSize: "14px",
                    margin: 0
                  }}>
                    Send one due-today summary and 15-minute todo reminders.
                  </p>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: isUpdatingNotifications ? "not-allowed" : "pointer" }}>
                  <input
                    type="checkbox"
                    checked={workspaceRemindersEnabled}
                    disabled={isUpdatingNotifications}
                    onChange={(e) => handleWorkspaceRemindersToggle(e.target.checked)}
                    style={{ width: "18px", height: "18px", cursor: isUpdatingNotifications ? "not-allowed" : "pointer" }}
                  />
                  <span style={{ color: darkMode ? "#ffffff" : "#1a4a52", fontSize: "14px", fontWeight: "600", minWidth: "72px" }}>
                    {workspaceRemindersEnabled ? "Enabled" : "Disabled"}
                  </span>
                </label>
              </div>

              <div style={{
                padding: "20px",
                borderRadius: "8px",
                background: darkMode ? "rgba(255, 255, 255, 0.03)" : "rgba(44, 110, 126, 0.03)",
                border: darkMode
                  ? "1px solid rgba(255, 255, 255, 0.08)"
                  : "1px solid rgba(44, 110, 126, 0.1)",
                marginTop: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "16px"
              }}>
                <div>
                  <h4 style={{
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "16px",
                    fontWeight: "600",
                    marginBottom: "4px"
                  }}>
                    Credit Reminders
                  </h4>
                  <p style={{
                    color: darkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(26, 74, 82, 0.5)",
                    fontSize: "14px",
                    margin: 0
                  }}>
                    Send reminders for overdue and upcoming unpaid credits.
                  </p>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: isUpdatingNotifications ? "not-allowed" : "pointer" }}>
                  <input
                    type="checkbox"
                    checked={creditRemindersEnabled}
                    disabled={isUpdatingNotifications}
                    onChange={(e) => handleCreditRemindersToggle(e.target.checked)}
                    style={{ width: "18px", height: "18px", cursor: isUpdatingNotifications ? "not-allowed" : "pointer" }}
                  />
                  <span style={{ color: darkMode ? "#ffffff" : "#1a4a52", fontSize: "14px", fontWeight: "600", minWidth: "72px" }}>
                    {creditRemindersEnabled ? "Enabled" : "Disabled"}
                  </span>
                </label>
              </div>

              <div style={{
                padding: "20px",
                borderRadius: "8px",
                background: darkMode ? "rgba(255, 255, 255, 0.03)" : "rgba(44, 110, 126, 0.03)",
                border: darkMode
                  ? "1px solid rgba(255, 255, 255, 0.08)"
                  : "1px solid rgba(44, 110, 126, 0.1)",
                marginTop: "14px"
              }}>
                <h4 style={{
                  color: darkMode ? "#ffffff" : "#1a4a52",
                  fontSize: "16px",
                  fontWeight: "600",
                  marginBottom: "6px"
                }}>
                  Low Stock Threshold
                </h4>
                <p style={{
                  color: darkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(26, 74, 82, 0.5)",
                  fontSize: "14px",
                  marginBottom: "14px"
                }}>
                  This value is used for all products in your inventory for low-stock alerts and counts.
                </p>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <input
                    type="range"
                    min={1}
                    max={200}
                    step={1}
                    value={lowStockThreshold}
                    disabled={isUpdatingLowStockThreshold || isUpdatingNotifications}
                    onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                    style={{ width: "260px", accentColor: "#d4a549", cursor: "pointer" }}
                  />
                  <span style={{
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    fontWeight: "700",
                    minWidth: "64px"
                  }}>
                    {lowStockThreshold} units
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveLowStockThreshold}
                    disabled={isUpdatingLowStockThreshold || isUpdatingNotifications}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "none",
                      background: darkMode ? "rgba(212,165,73,0.24)" : "rgba(212,165,73,0.2)",
                      color: darkMode ? "#f3d28f" : "#8a6d1f",
                      fontSize: "13px",
                      fontWeight: "700",
                      cursor: (isUpdatingLowStockThreshold || isUpdatingNotifications) ? "not-allowed" : "pointer",
                      opacity: (isUpdatingLowStockThreshold || isUpdatingNotifications) ? 0.7 : 1,
                    }}
                  >
                    {isUpdatingLowStockThreshold ? "Saving..." : "Save Threshold"}
                  </button>
                </div>
              </div>
            </div>
            )}

            {/* Danger Zone */}
            <div style={{
              background: darkMode ? "#1a1a1a" : "#ffffff",
              borderRadius: "12px",
              padding: "30px",
              boxShadow: darkMode 
                ? "0 4px 12px rgba(0, 0, 0, 0.5)" 
                : "0 4px 12px rgba(0, 0, 0, 0.1)",
              border: "2px solid rgba(220, 38, 38, 0.3)"
            }}>
              <h3 style={{
                color: "#dc2626",
                fontSize: "20px",
                fontWeight: "600",
                marginBottom: "8px"
              }}>
                Danger Zone
              </h3>
              <p style={{
                color: darkMode ? "rgba(255, 255, 255, 0.6)" : "rgba(26, 74, 82, 0.6)",
                fontSize: "14px",
                marginBottom: "24px"
              }}>
                Irreversible actions that will permanently affect your account
              </p>

              {/* Delete Account Option */}
              <div style={{
                padding: "20px",
                borderRadius: "8px",
                background: "rgba(220, 38, 38, 0.05)",
                border: "1px solid rgba(220, 38, 38, 0.2)"
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: showDeleteConfirm ? "20px" : "0"
                }}>
                  <div>
                    <h4 style={{
                      color: "#dc2626",
                      fontSize: "16px",
                      fontWeight: "600",
                      marginBottom: "4px"
                    }}>
                      Delete Account
                    </h4>
                    <p style={{
                      color: darkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(26, 74, 82, 0.5)",
                      fontSize: "14px",
                      margin: 0
                    }}>
                      Permanently delete your account and all associated data
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#dc2626",
                      color: "#ffffff",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#b91c1c";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#dc2626";
                    }}
                  >
                    Delete Account
                  </button>
                </div>

                {/* Delete Confirmation */}
                {showDeleteConfirm && (
                  <div style={{
                    paddingTop: "20px",
                    borderTop: "1px solid rgba(220, 38, 38, 0.2)",
                    animation: "fadeIn 0.3s ease"
                  }}>
                    <p style={{
                      color: darkMode ? "rgba(255, 255, 255, 0.7)" : "rgba(26, 74, 82, 0.7)",
                      fontSize: "14px",
                      marginBottom: "12px"
                    }}>
                      This action cannot be undone. Please type <strong>{user?.username}</strong> to confirm:
                    </p>
                    <input
                      type="text"
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                      placeholder="Enter your username"
                      style={{
                        width: "100%",
                        padding: "10px 16px",
                        borderRadius: "8px",
                        border: darkMode 
                          ? "1px solid rgba(255, 255, 255, 0.1)" 
                          : "1px solid rgba(44, 110, 126, 0.2)",
                        background: darkMode ? "rgba(255, 255, 255, 0.05)" : "#ffffff",
                        color: darkMode ? "#ffffff" : "#1a4a52",
                        fontSize: "14px",
                        outline: "none",
                        marginBottom: "12px"
                      }}
                    />
                    <div style={{
                      display: "flex",
                      gap: "12px",
                      justifyContent: "flex-end"
                    }}>
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteInput("");
                        }}
                        style={{
                          padding: "10px 20px",
                          borderRadius: "8px",
                          border: darkMode 
                            ? "1px solid rgba(255, 255, 255, 0.1)" 
                            : "1px solid rgba(44, 110, 126, 0.2)",
                          background: "transparent",
                          color: darkMode ? "#ffffff" : "#1a4a52",
                          fontSize: "14px",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.2s ease"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = darkMode 
                            ? "rgba(255, 255, 255, 0.05)" 
                            : "rgba(44, 110, 126, 0.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteInput !== user?.username}
                        style={{
                          padding: "10px 20px",
                          borderRadius: "8px",
                          border: "none",
                          background: deleteInput === user?.username ? "#dc2626" : "rgba(220, 38, 38, 0.3)",
                          color: "#ffffff",
                          fontSize: "14px",
                          fontWeight: "600",
                          cursor: deleteInput === user?.username ? "pointer" : "not-allowed",
                          transition: "all 0.2s ease",
                          opacity: deleteInput === user?.username ? 1 : 0.5
                        }}
                        onMouseEnter={(e) => {
                          if (deleteInput === user?.username) {
                            e.currentTarget.style.background = "#b91c1c";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (deleteInput === user?.username) {
                            e.currentTarget.style.background = "#dc2626";
                          }
                        }}
                      >
                        Confirm Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showExportDurationModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: darkMode ? "rgba(0, 0, 0, 0.7)" : "rgba(26, 74, 82, 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1200,
          padding: "16px",
        }}>
          <div style={{
            width: "100%",
            maxWidth: "520px",
            borderRadius: "14px",
            background: darkMode ? "#181818" : "#ffffff",
            border: darkMode ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(44,110,126,0.2)",
            boxShadow: darkMode ? "0 24px 48px rgba(0,0,0,0.5)" : "0 24px 48px rgba(26,74,82,0.2)",
            padding: "22px",
          }}>
            <h3 style={{ color: darkMode ? "#ffffff" : "#1a4a52", fontSize: "20px", marginBottom: "8px" }}>
              Export Data Range
            </h3>
            <p style={{ color: darkMode ? "rgba(255,255,255,0.65)" : "rgba(26,74,82,0.7)", fontSize: "14px", marginBottom: "16px" }}>
              Choose how much historical data to include in your export file.
            </p>

            <div style={{ display: "grid", gap: "10px", marginBottom: "18px" }}>
              {exportDurationOptions.map((option) => {
                const active = exportDuration === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setExportDuration(option.value)}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: active
                        ? "1px solid rgba(212, 165, 73, 0.8)"
                        : darkMode
                          ? "1px solid rgba(255,255,255,0.12)"
                          : "1px solid rgba(44,110,126,0.2)",
                      background: active
                        ? darkMode
                          ? "rgba(212, 165, 73, 0.18)"
                          : "rgba(212, 165, 73, 0.16)"
                        : darkMode
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(44,110,126,0.03)",
                      color: darkMode ? "#ffffff" : "#1a4a52",
                      fontSize: "14px",
                      fontWeight: active ? "700" : "500",
                      cursor: "pointer",
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setShowExportDurationModal(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: darkMode ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(44,110,126,0.25)",
                  background: "transparent",
                  color: darkMode ? "#ffffff" : "#1a4a52",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: isExporting ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={handleExportData}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: darkMode ? "rgba(212, 165, 73, 0.3)" : "rgba(212, 165, 73, 0.2)",
                  color: darkMode ? "#f7d895" : "#8a6d1f",
                  fontSize: "14px",
                  fontWeight: "700",
                  cursor: isExporting ? "not-allowed" : "pointer",
                  opacity: isExporting ? 0.7 : 1,
                }}
              >
                {isExporting ? "Starting Export..." : "Start Export"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
