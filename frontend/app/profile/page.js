"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import DashboardNavbar from "@/app/components/Navbar";
import DashboardSidebar from "@/app/components/Sidebar";
import { fetchWithAuth, clearAuthStoragePreserveTheme } from "@/lib/auth";
import { useSyncedTheme } from "@/lib/theme";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { darkMode, toggleTheme } = useSyncedTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Password visibility states
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Form fields
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
  });
  
  // Password fields
  const [passwordData, setPasswordData] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  
  const [errors, setErrors] = useState({});
  
  // Alert notification state
  const [alert, setAlert] = useState(null);

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
      setFormData({
        full_name: userData.full_name || "",
        email: userData.email || "",
      });
    } else {
      router.replace("/login");
    }

    setLoading(false);
  }, [router]);
  
  const showAlert = (message, type = 'error') => {
    setAlert({ message, type });
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setAlert(null);
    }, 5000);
  };

  const handleSignOut = () => {
    clearAuthStoragePreserveTheme();
    router.replace("/login");
  };

  const handleProfileClick = async () => {
    // Already on profile page
    console.log("Already on profile page");
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setErrors({});
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset form data to original user data
    setFormData({
      full_name: user.full_name || "",
      email: user.email || "",
    });
    setPasswordData({
      old_password: "",
      new_password: "",
      confirm_password: "",
    });
    // Reset password visibility
    setShowOldPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setErrors({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    
    // Only check if old password is provided when any password field is filled
    const hasPasswordInput = passwordData.old_password || passwordData.new_password || passwordData.confirm_password;
    
    if (hasPasswordInput) {
      if (!passwordData.old_password) {
        newErrors.old_password = "Old password is required";
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const validateNewPassword = () => {
    // Validate new password requirements
    if (!passwordData.new_password) {
      showAlert("New password is required", 'error');
      return false;
    }
    
    // Password strength validation
    if (passwordData.new_password.length < 8) {
      showAlert("Password must be at least 8 characters long", 'error');
      return false;
    }
    
    if (!/[A-Z]/.test(passwordData.new_password)) {
      showAlert("Password must contain at least one uppercase letter", 'error');
      return false;
    }
    
    if (!/[a-z]/.test(passwordData.new_password)) {
      showAlert("Password must contain at least one lowercase letter", 'error');
      return false;
    }
    
    if (!/[0-9]/.test(passwordData.new_password)) {
      showAlert("Password must contain at least one number", 'error');
      return false;
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'\/`~]/.test(passwordData.new_password)) {
      showAlert("Password must contain at least one special character", 'error');
      return false;
    }
    
    // Check if passwords match
    if (passwordData.new_password !== passwordData.confirm_password) {
      showAlert("Passwords do not match", 'error');
      return false;
    }
    
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    
    try {
      const hasPasswordInput = passwordData.old_password || passwordData.new_password || passwordData.confirm_password;
      
      // If password change is requested
      if (hasPasswordInput) {
        // Quick sanity check: verify user typed the same password twice
        // This is NOT a password requirement check - just preventing user input errors
        if (passwordData.new_password !== passwordData.confirm_password) {
          showAlert("Passwords do not match", 'error');
          setIsSaving(false);
          return;
        }
        
        // Send the password change request to backend
        // Backend will check old password FIRST, then new password requirements
        try {
          const passwordRes = await fetchWithAuth("http://localhost:5001/api/auth/change-password", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              current_password: passwordData.old_password,
              new_password: passwordData.new_password,
            }),
          });

          if (!passwordRes.ok) {
            const errorData = await passwordRes.json();
            const errorMsg = errorData.error || 'Failed to change password';
            
            // Show error from backend
            // Backend checks old password FIRST (returns "Current password is incorrect" if wrong)
            // Only if old password is correct, backend then checks new password format requirements
            showAlert(errorMsg, 'error');
            setIsSaving(false);
            return;
          }
        } catch (error) {
          showAlert("Failed to change password", 'error');
          setIsSaving(false);
          return;
        }
      }
      
      // Update profile information
      const profileUpdateData = {
        full_name: formData.full_name,
        email: formData.email,
      };

      const profileRes = await fetchWithAuth("http://localhost:5001/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileUpdateData),
      });

      if (!profileRes.ok) {
        const errorData = await profileRes.json();
        throw new Error(errorData.error || "Failed to update profile");
      }

      const profileData = await profileRes.json();

      // Update local storage and state
      const updatedUser = profileData.user;
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      // Reset password fields
      setPasswordData({
        old_password: "",
        new_password: "",
        confirm_password: "",
      });
      
      // Reset password visibility
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      
      setIsEditing(false);
      showAlert(
        hasPasswordInput ? "Profile and password updated successfully!" : "Profile updated successfully!", 
        'success'
      );
      
    } catch (error) {
      console.error("Error updating profile:", error);
      showAlert(error.message || "Failed to update profile", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const getInputStyle = (hasError) => ({
    width: "100%",
    padding: "10px 16px",
    borderRadius: "8px",
    border: hasError 
      ? "2px solid #ef4444" 
      : (darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)"),
    background: darkMode ? "rgba(255, 255, 255, 0.05)" : "#ffffff",
    color: darkMode ? "#ffffff" : "#1a4a52",
    fontSize: "16px",
    outline: "none",
    transition: "all 0.2s ease"
  });

  const errorStyle = {
    color: "#dc2626",
    fontSize: "12px",
    marginTop: "4px"
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

      {/* Custom Alert Notification */}
      {alert && (
        <div style={{
          position: 'fixed',
          top: '90px',
          right: '20px',
          zIndex: 9999,
          minWidth: '320px',
          maxWidth: '500px',
          background: alert.type === 'success' 
            ? (darkMode ? 'rgba(74, 222, 128, 0.2)' : 'rgba(74, 222, 128, 0.15)')
            : (darkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)'),
          border: alert.type === 'success'
            ? `2px solid ${darkMode ? '#4ade80' : '#22c55e'}`
            : `2px solid ${darkMode ? '#ef4444' : '#dc2626'}`,
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          animation: 'slideIn 0.3s ease-out',
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            flex: 1
          }}>
            {alert.type === 'success' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#4ade80' : '#22c55e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#ef4444' : '#dc2626'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            )}
            <span style={{ 
              color: alert.type === 'success' 
                ? (darkMode ? '#4ade80' : '#22c55e')
                : (darkMode ? '#fca5a5' : '#dc2626'),
              fontSize: '15px',
              fontWeight: '600',
              lineHeight: '1.4'
            }}>
              {alert.message}
            </span>
          </div>
          <button
            onClick={() => setAlert(null)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all 0.2s ease',
              color: alert.type === 'success' ? '#4ade80' : '#ef4444',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = alert.type === 'success'
                ? 'rgba(74, 222, 128, 0.3)'
                : 'rgba(239, 68, 68, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <style jsx>{`
            @keyframes slideIn {
              from {
                transform: translateX(400px);
                opacity: 0;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }
          `}</style>
        </div>
      )}

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
              My Profile
            </h1>

            {/* Profile Card */}
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
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "24px"
              }}>
                {/* Profile Picture */}
                <div style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: darkMode 
                    ? "linear-gradient(135deg, rgba(212, 165, 73, 0.3) 0%, rgba(44, 110, 126, 0.3) 100%)"
                    : "linear-gradient(135deg, rgba(212, 165, 73, 0.2) 0%, rgba(44, 110, 126, 0.2) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: darkMode 
                    ? "2px solid rgba(212, 165, 73, 0.5)" 
                    : "2px solid rgba(44, 110, 126, 0.5)"
                }}>
                  <Image
                    src="/vectors/profile.png"
                    alt="Profile"
                    width={40}
                    height={40}
                    style={{
                      filter: darkMode ? "brightness(0) invert(1)" : "none",
                    }}
                  />
                </div>

                {/* Profile Info */}
                <div style={{ flex: 1 }}>
                  <h2 style={{
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "24px",
                    fontWeight: "600",
                    marginBottom: "4px"
                  }}>
                    {user.full_name || "Full Name"}
                  </h2>
                  <p style={{
                    color: darkMode ? "rgba(255, 255, 255, 0.6)" : "rgba(26, 74, 82, 0.6)",
                    fontSize: "16px",
                    fontWeight: "400"
                  }}>
                    @{user.username || "username"}
                  </p>
                </div>

                {/* Role Badge */}
                <div style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  background: darkMode 
                    ? "rgba(212, 165, 73, 0.2)" 
                    : "rgba(212, 165, 73, 0.15)",
                  border: darkMode 
                    ? "1px solid rgba(212, 165, 73, 0.4)" 
                    : "1px solid rgba(212, 165, 73, 0.3)",
                  color: darkMode ? "#d4a549" : "#b8932f",
                  fontSize: "14px",
                  fontWeight: "600",
                  textTransform: "capitalize"
                }}>
                  {user.role || "User"}
                </div>
              </div>
            </div>

            {/* Additional Profile Information */}
            <div style={{
              background: darkMode ? "#1a1a1a" : "#ffffff",
              borderRadius: "12px",
              padding: "30px",
              boxShadow: darkMode 
                ? "0 4px 12px rgba(0, 0, 0, 0.5)" 
                : "0 4px 12px rgba(0, 0, 0, 0.1)",
              border: darkMode 
                ? "1px solid rgba(255, 255, 255, 0.1)" 
                : "1px solid rgba(44, 110, 126, 0.15)"
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px"
              }}>
                <h3 style={{
                  color: darkMode ? "#ffffff" : "#1a4a52",
                  fontSize: "20px",
                  fontWeight: "600",
                  margin: 0
                }}>
                  Account Information
                </h3>
                {!isEditing ? (
                  <button
                    className="profile-edit-icon-btn"
                    onClick={handleEditClick}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "8px",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = darkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(44, 110, 126, 0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                    title="Edit Profile"
                  >
                    <svg 
                      width="20" 
                      height="20" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke={darkMode ? "#ffffff" : "#1a4a52"}
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                    </svg>
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
                        background: "transparent",
                        color: darkMode ? "#ffffff" : "#1a4a52",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor: isSaving ? "not-allowed" : "pointer",
                        transition: "all 0.2s ease",
                        opacity: isSaving ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!isSaving) {
                          e.currentTarget.style.background = darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(44, 110, 126, 0.05)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "none",
                        background: darkMode ? "rgba(212, 165, 73, 0.2)" : "rgba(212, 165, 73, 0.15)",
                        color: darkMode ? "#d4a549" : "#b8932f",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor: isSaving ? "not-allowed" : "pointer",
                        transition: "all 0.2s ease",
                        opacity: isSaving ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!isSaving) {
                          e.currentTarget.style.background = darkMode ? "rgba(212, 165, 73, 0.3)" : "rgba(212, 165, 73, 0.25)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSaving) {
                          e.currentTarget.style.background = darkMode ? "rgba(212, 165, 73, 0.2)" : "rgba(212, 165, 73, 0.15)";
                        }
                      }}
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Full Name */}
                <div>
                  <label style={{
                    color: darkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(26, 74, 82, 0.5)",
                    fontSize: "14px",
                    fontWeight: "500",
                    marginBottom: "8px",
                    display: "block"
                  }}>
                    Full Name
                  </label>
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleInputChange}
                        style={getInputStyle(errors.full_name)}
                        placeholder="Enter your full name"
                      />
                      {errors.full_name && <div style={errorStyle}>{errors.full_name}</div>}
                    </>
                  ) : (
                    <div style={{
                      color: darkMode ? "#ffffff" : "#1a4a52",
                      fontSize: "16px",
                      fontWeight: "500"
                    }}>
                      {user.full_name || "Not set"}
                    </div>
                  )}
                </div>

                {/* Username */}
                <div>
                  <label style={{
                    color: darkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(26, 74, 82, 0.5)",
                    fontSize: "14px",
                    fontWeight: "500",
                    marginBottom: "8px",
                    display: "block"
                  }}>
                    Username
                  </label>
                  <div style={{
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "16px",
                    fontWeight: "500"
                  }}>
                    {user.username || "Not set"}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label style={{
                    color: darkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(26, 74, 82, 0.5)",
                    fontSize: "14px",
                    fontWeight: "500",
                    marginBottom: "8px",
                    display: "block"
                  }}>
                    Email
                  </label>
                  {isEditing ? (
                    <>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        style={getInputStyle(errors.email)}
                        placeholder="Enter your email"
                      />
                      {errors.email && <div style={errorStyle}>{errors.email}</div>}
                    </>
                  ) : (
                    <div style={{
                      color: darkMode ? "#ffffff" : "#1a4a52",
                      fontSize: "16px",
                      fontWeight: "500"
                    }}>
                      {user.email || "Not set"}
                    </div>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label style={{
                    color: darkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(26, 74, 82, 0.5)",
                    fontSize: "14px",
                    fontWeight: "500",
                    marginBottom: "8px",
                    display: "block"
                  }}>
                    Password
                  </label>
                  {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {/* Old Password */}
                      <div style={{ position: "relative" }}>
                        <input
                          type={showOldPassword ? "text" : "password"}
                          name="old_password"
                          value={passwordData.old_password}
                          onChange={handlePasswordChange}
                          style={{ ...getInputStyle(errors.old_password), paddingRight: "40px" }}
                          placeholder="Old password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          style={{
                            position: "absolute",
                            right: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center",
                            color: darkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(26, 74, 82, 0.5)"
                          }}
                        >
                          {showOldPassword ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                              <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          )}
                        </button>
                        {errors.old_password && <div style={errorStyle}>{errors.old_password}</div>}
                      </div>
                      
                      {/* New Password */}
                      <div style={{ position: "relative" }}>
                        <input
                          type={showNewPassword ? "text" : "password"}
                          name="new_password"
                          value={passwordData.new_password}
                          onChange={handlePasswordChange}
                          style={{ ...getInputStyle(errors.new_password), paddingRight: "40px" }}
                          placeholder="New password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          style={{
                            position: "absolute",
                            right: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center",
                            color: darkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(26, 74, 82, 0.5)"
                          }}
                        >
                          {showNewPassword ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                              <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          )}
                        </button>
                      </div>
                      
                      {/* Confirm Password */}
                      <div style={{ position: "relative" }}>
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirm_password"
                          value={passwordData.confirm_password}
                          onChange={handlePasswordChange}
                          style={{ ...getInputStyle(errors.confirm_password), paddingRight: "40px" }}
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={{
                            position: "absolute",
                            right: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center",
                            color: darkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(26, 74, 82, 0.5)"
                          }}
                        >
                          {showConfirmPassword ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                              <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          )}
                        </button>
                      </div>
                      
                      {/* Password Requirements */}
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: darkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(26, 74, 82, 0.6)',
                        padding: '12px 16px',
                        background: darkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(44, 110, 126, 0.03)',
                        borderRadius: '8px',
                        border: darkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(44, 110, 126, 0.1)'
                      }}>
                        <p style={{ 
                          margin: '0 0 8px 0', 
                          fontWeight: '600', 
                          color: darkMode ? '#ffffff' : '#1a4a52'
                        }}>
                          Password Requirements:
                        </p>
                        <ul style={{ margin: 0, paddingLeft: '20px', listStyle: 'none' }}>
                          <li style={{ marginBottom: '4px' }}>
                            <span style={{ 
                              color: passwordData.new_password.length >= 8 ? '#4ade80' : 'inherit' 
                            }}>
                              {passwordData.new_password.length >= 8 ? '✓' : '•'} At least 8 characters
                            </span>
                          </li>
                          <li style={{ marginBottom: '4px' }}>
                            <span style={{ 
                              color: /[A-Z]/.test(passwordData.new_password) ? '#4ade80' : 'inherit' 
                            }}>
                              {/[A-Z]/.test(passwordData.new_password) ? '✓' : '•'} One uppercase letter (A-Z)
                            </span>
                          </li>
                          <li style={{ marginBottom: '4px' }}>
                            <span style={{ 
                              color: /[a-z]/.test(passwordData.new_password) ? '#4ade80' : 'inherit' 
                            }}>
                              {/[a-z]/.test(passwordData.new_password) ? '✓' : '•'} One lowercase letter (a-z)
                            </span>
                          </li>
                          <li style={{ marginBottom: '4px' }}>
                            <span style={{ 
                              color: /[0-9]/.test(passwordData.new_password) ? '#4ade80' : 'inherit' 
                            }}>
                              {/[0-9]/.test(passwordData.new_password) ? '✓' : '•'} One number (0-9)
                            </span>
                          </li>
                          <li style={{ marginBottom: '4px' }}>
                            <span style={{ 
                              color: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'\/`~]/.test(passwordData.new_password) ? '#4ade80' : 'inherit' 
                            }}>
                              {/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'\/`~]/.test(passwordData.new_password) ? '✓' : '•'} At least one special character
                            </span>
                          </li>
                          <li>
                            <span style={{ 
                              color: passwordData.new_password && passwordData.new_password === passwordData.confirm_password && passwordData.new_password.length > 0 ? '#4ade80' : 'inherit' 
                            }}>
                              {passwordData.new_password && passwordData.new_password === passwordData.confirm_password && passwordData.new_password.length > 0 ? '✓' : '•'} Passwords match
                            </span>
                          </li>
                        </ul>
                      </div>
                      
                      <div style={{
                        color: darkMode ? "rgba(255, 255, 255, 0.4)" : "rgba(26, 74, 82, 0.4)",
                        fontSize: "12px"
                      }}>
                        Leave blank if you don't want to change password
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      color: darkMode ? "#ffffff" : "#1a4a52",
                      fontSize: "16px",
                      fontWeight: "500"
                    }}>
                      ••••••••
                    </div>
                  )}
                </div>

                {/* Role */}
                <div>
                  <label style={{
                    color: darkMode ? "rgba(255, 255, 255, 0.5)" : "rgba(26, 74, 82, 0.5)",
                    fontSize: "14px",
                    fontWeight: "500",
                    marginBottom: "8px",
                    display: "block"
                  }}>
                    Role
                  </label>
                  <div style={{
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "16px",
                    fontWeight: "500",
                    textTransform: "capitalize"
                  }}>
                    {user.role || "Not set"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
