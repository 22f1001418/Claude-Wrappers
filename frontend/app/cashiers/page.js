"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styler from "@/styles/cashiers.module.css";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { BACKEND_URL, getBackendUrl } from "@/lib/backend_url";
import { useSyncedTheme } from "@/lib/theme";
import { clearAuthStoragePreserveTheme } from "@/lib/auth";

export default function ManageCashiers() {
  const { darkMode, toggleTheme } = useSyncedTheme();
  const [showAddForm, setShowAddForm] = useState(false);
  const [cashiers, setCashiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    full_name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check authentication and fetch cashiers
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Get user data
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      
      // Check if user is authorized (owner or admin)
      if (userData.role !== 'owner' && userData.role !== 'user' && userData.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
    }

    fetchCashiers();
  }, []);

  const handleSignOut = async () => {
    try {
      const url = await getBackendUrl();
      const token = localStorage.getItem('access_token');
      
      await fetch(`${url}/api/auth/logout`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      clearAuthStoragePreserveTheme();
      router.replace("/login");
    }
  };

  const fetchCashiers = async () => {
    try {
      const url = await getBackendUrl();
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${url}/api/auth/cashiers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch cashiers');
      }

      const data = await response.json();
      setCashiers(data.cashiers || []);
    } catch (err) {
      console.error('Error fetching cashiers:', err);
      setError('Failed to load cashiers');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate all required fields
    if (!formData.full_name.trim()) {
      setError("Full name is required");
      return;
    }

    if (!formData.username.trim()) {
      setError("Username is required");
      return;
    }

    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      setError("Invalid email format");
      return;
    }

    if (!formData.password) {
      setError("Password is required");
      return;
    }

    if (!formData.confirmPassword) {
      setError("Confirm password is required");
      return;
    }

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (!/[A-Z]/.test(formData.password)) {
      setError("Password must contain at least one uppercase letter");
      return;
    }

    if (!/[a-z]/.test(formData.password)) {
      setError("Password must contain at least one lowercase letter");
      return;
    }

    if (!/[0-9]/.test(formData.password)) {
      setError("Password must contain at least one number");
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'\/`~]/.test(formData.password)) {
      setError("Password must contain at least one special character");
      return;
    }

    setSubmitting(true);

    try {
      const url = await getBackendUrl();
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${url}/api/auth/cashiers`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          username: formData.username,
          email: formData.email,
          password: formData.password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create cashier");
      }

      setSuccess(`Cashier ${formData.username} created successfully!`);
      
      // Reset form
      setFormData({
        full_name: "",
        username: "",
        email: "",
        password: "",
        confirmPassword: ""
      });

      // Refresh cashiers list
      fetchCashiers();

      // Hide form after 2 seconds
      setTimeout(() => {
        setShowAddForm(false);
        setSuccess("");
      }, 2000);

    } catch (err) {
      setError(err.message || "Failed to create cashier. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (username) => {
    if (!confirm(`Are you sure you want to delete cashier "${username}"?`)) {
      return;
    }

    try {
      const url = await getBackendUrl();
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${url}/api/auth/cashiers/${username}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete cashier");
      }

      setSuccess(data.message);
      fetchCashiers();

      setTimeout(() => setSuccess(""), 3000);

    } catch (err) {
      setError(err.message || "Failed to delete cashier");
      setTimeout(() => setError(""), 3000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar 
        darkMode={darkMode} 
        toggleTheme={toggleTheme} 
        user={user}
      />
      
      <div style={{ display: "flex", marginTop: "70px" }}>
        <Sidebar 
          darkMode={darkMode} 
          user={user}
          handleSignOut={handleSignOut}
        />
        
        <main className={styler.main}>
          <div className={styler.header}>
            <div className={styler.headerLeft}>
              <h1>Manage Cashiers</h1>
              <p>Add, view, and manage cashier accounts</p>
            </div>
            <button 
              className={styler.addButton}
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? "Cancel" : "+ Add Cashier"}
            </button>
          </div>

          {/* Add Cashier Form */}
          {showAddForm && (
            <div className={styler.formCard}>
              <h2>Add New Cashier</h2>
              
              {error && (
                <div className={styler.errorMessage}>
                  {error}
                </div>
              )}

              {success && (
                <div className={styler.successMessage}>
                  {success}
                </div>
              )}

              <form className={styler.form} onSubmit={handleSubmit}>
                <div className={styler.formGroup}>
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    name="full_name"
                    placeholder="Enter full name" 
                    value={formData.full_name}
                    onChange={handleChange}
                    required 
                    disabled={submitting}
                  />
                </div>

                <div className={styler.formGroup}>
                  <label>Username</label>
                  <input 
                    type="text" 
                    name="username"
                    placeholder="Enter username" 
                    value={formData.username}
                    onChange={handleChange}
                    required 
                    disabled={submitting}
                  />
                </div>

                <div className={styler.formGroup}>
                  <label>Email</label>
                  <input 
                    type="email" 
                    name="email"
                    placeholder="Enter email address" 
                    value={formData.email}
                    onChange={handleChange}
                    required 
                    disabled={submitting}
                  />
                </div>

                <div className={styler.formGroup}>
                  <label>Password</label>
                  <input 
                    type="password" 
                    name="password"
                    placeholder="Enter password" 
                    value={formData.password}
                    onChange={handleChange}
                    required 
                    disabled={submitting}
                  />
                </div>

                <div className={styler.formGroup}>
                  <label>Confirm Password</label>
                  <input 
                    type="password" 
                    name="confirmPassword"
                    placeholder="Confirm password" 
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required 
                    disabled={submitting}
                  />
                </div>
                
                {/* Password Requirements */}
                <div className={styler.passwordRequirements}>
                  <p className={styler.requirementsTitle}>Password Requirements:</p>
                  <ul>
                    <li className={formData.password.length >= 8 ? styler.valid : ''}>
                      {formData.password.length >= 8 ? '✓' : '•'} At least 8 characters
                    </li>
                    <li className={/[A-Z]/.test(formData.password) ? styler.valid : ''}>
                      {/[A-Z]/.test(formData.password) ? '✓' : '•'} One uppercase letter (A-Z)
                    </li>
                    <li className={/[a-z]/.test(formData.password) ? styler.valid : ''}>
                      {/[a-z]/.test(formData.password) ? '✓' : '•'} One lowercase letter (a-z)
                    </li>
                    <li className={/[0-9]/.test(formData.password) ? styler.valid : ''}>
                      {/[0-9]/.test(formData.password) ? '✓' : '•'} One number (0-9)
                    </li>
                    <li className={/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'\/`~]/.test(formData.password) ? styler.valid : ''}>
                      {/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'\/`~]/.test(formData.password) ? '✓' : '•'} At least one special character
                    </li>
                    <li className={formData.password && formData.password === formData.confirmPassword && formData.password.length > 0 ? styler.valid : ''}>
                      {formData.password && formData.password === formData.confirmPassword && formData.password.length > 0 ? '✓' : '•'} Passwords match
                    </li>
                  </ul>
                </div>
                
                <button 
                  type="submit" 
                  className={styler.submitButton}
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "Create Cashier"}
                </button>
              </form>
            </div>
          )}

          {/* Cashiers List */}
          <div className={styler.cashiersSection}>
            <h2>All Cashiers ({cashiers.length})</h2>
            
            {loading ? (
              <div className={styler.loading}>Loading cashiers...</div>
            ) : cashiers.length === 0 ? (
              <div className={styler.emptyState}>
                <p>No cashiers found. Add your first cashier using the button above.</p>
              </div>
            ) : (
              <div className={styler.cashiersGrid}>
                {cashiers.map((cashier) => (
                  <div key={cashier.username} className={styler.cashierCard}>
                    <div className={styler.cashierInfo}>
                      <div className={styler.cashierAvatar}>
                        {cashier.full_name ? cashier.full_name.charAt(0).toUpperCase() : cashier.username.charAt(0).toUpperCase()}
                      </div>
                      <div className={styler.cashierDetails}>
                        <h3>{cashier.full_name || cashier.username}</h3>
                        <p className={styler.username}>@{cashier.username}</p>
                        {cashier.email && <p className={styler.email}>{cashier.email}</p>}
                        {cashier.added_by_name && (
                          <p className={styler.addedBy}>
                            Added by: {cashier.added_by_name}
                          </p>
                        )}
                        {cashier.date_added && (
                          <p className={styler.dateAdded}>
                            {new Date(cashier.date_added).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                    <button 
                      className={styler.deleteButton}
                      onClick={() => handleDelete(cashier.username)}
                      title="Delete cashier"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
