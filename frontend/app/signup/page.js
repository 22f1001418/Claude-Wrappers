"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styler from "@/styles/login.module.css";
import Link from "next/link";
import { getBackendUrl } from "@/lib/backend_url";
import { emitErrorToast, emitSuccessToast } from "@/lib/toast";
import { useSyncedTheme } from "@/lib/theme";

export default function Signup() {
  const { darkMode } = useSyncedTheme();
  const [formData, setFormData] = useState({    full_name: "",    username: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const googleButtonRef = useRef(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse
      });

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: darkMode ? "filled_black" : "outline",
        size: "large",
        width: "100%",
        shape: "pill",
        text: "continue_with"
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return;
    }

    const scriptId = "google-identity-services";
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.addEventListener("load", renderGoogleButton);
      return () => existingScript.removeEventListener("load", renderGoogleButton);
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.body.appendChild(script);
  }, [googleClientId, darkMode]);

  const handleGoogleCredentialResponse = async (response) => {
    if (!response?.credential) {
      setError("Google signup failed. No credential was returned.");
      emitErrorToast("Google signup failed. No credential was returned.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const url = await getBackendUrl();
      const backendResponse = await fetch(`${url}/api/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ credential: response.credential })
      });

      const data = await backendResponse.json();

      if (!backendResponse.ok) {
        throw new Error(data.error || "Google signup failed");
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      emitSuccessToast(`Welcome, ${data?.user?.username || "user"}`);
      router.push("/dashboard");
    } catch (err) {
      const message = err.message || "Google signup failed. Please try again.";
      setError(message);
      emitErrorToast(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(""); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

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

    setLoading(true);

    try {
      const url = await getBackendUrl();
      const response = await fetch(`${url}/api/auth/signup`, {
        method: "POST",
        headers: {
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
        throw new Error(data.error || "Signup failed");
      }

      // Store tokens in localStorage
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      emitSuccessToast(`Account created successfully! Welcome, ${data?.user?.username || "user"}`);

      // Redirect to home page or dashboard
      router.push("/");

    } catch (err) {
      const message = err.message || "Signup failed. Please try again.";
      setError(message);
      emitErrorToast(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styler.main}>
      <Link 
        href="/"
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          fontSize: '14px',
          fontWeight: '500',
          color: 'var(--text-primary, #1a4a52)',
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, rgba(44, 110, 126, 0.2))',
          borderRadius: '8px',
          textDecoration: 'none',
          transition: 'all 0.2s ease',
          zIndex: 10
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-hover, rgba(44, 110, 126, 0.05))';
          e.currentTarget.style.transform = 'translateX(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
          e.currentTarget.style.transform = 'translateX(0)';
        }}
      >
        <span>←</span>
        <span>Back to Home</span>
      </Link>
      <div className={styler.master}>
        <div className={styler.image}>
          <Image
            src="/vectors/undraw_onboarding_dcq2.svg"
            alt="Signup Image"
            width={500}
            height={500}
          />
        </div>
        <div className={styler.text}>
          <h2>Create your account</h2>
          <p style={{ margin: "10px 0 8px", color: "var(--text-muted, #666)", fontSize: "0.95rem" }}>
            Continue with Google
          </p>
          <div className={styler.google_auth}>
            <div ref={googleButtonRef}></div>
            {!googleClientId && (
              <p style={{ marginTop: "10px", color: "#b45309", fontSize: "0.85rem" }}>
                Google sign-in is not configured.
              </p>
            )}
          </div>
          <div className={styler.or_div}>
            <p className={styler.or_text}>-OR-</p>
          </div>
          
          {error && (
            <div style={{ 
              color: 'red', 
              backgroundColor: 'rgba(255, 0, 0, 0.1)', 
              padding: '10px', 
              borderRadius: '5px', 
              marginBottom: '15px',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <form className={styler.login_form} onSubmit={handleSubmit}>
            <input 
              type="text" 
              name="full_name"
              placeholder="Full Name" 
              value={formData.full_name}
              onChange={handleChange}
              required 
              disabled={loading}
            />
            <input 
              type="text" 
              name="username"
              placeholder="Username" 
              value={formData.username}
              onChange={handleChange}
              required 
              disabled={loading}
            />
            <input 
              type="email" 
              name="email"
              placeholder="Email" 
              value={formData.email}
              onChange={handleChange}
              required 
              disabled={loading}
            />
            <input 
              type="password" 
              name="password"
              placeholder="Password" 
              value={formData.password}
              onChange={handleChange}
              required 
              disabled={loading}
            />
            <input 
              type="password" 
              name="confirmPassword"
              placeholder="Confirm Password" 
              value={formData.confirmPassword}
              onChange={handleChange}
              required 
              disabled={loading}
            />
            
            {/* Password Requirements */}
            <div style={{ 
              fontSize: '0.85rem', 
              color: 'var(--text-muted, #666)',
              padding: '10px 15px',
              backgroundColor: 'var(--bg-secondary, rgba(255, 255, 255, 0.05))',
              borderRadius: '8px',
              marginBottom: '10px',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))'
            }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: 'var(--text-primary)' }}>
                Password Requirements:
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px', listStyle: 'none' }}>
                <li style={{ marginBottom: '5px' }}>
                  <span style={{ color: formData.password.length >= 8 ? '#4ade80' : 'inherit' }}>
                    {formData.password.length >= 8 ? '✓' : '•'} At least 8 characters
                  </span>
                </li>
                <li style={{ marginBottom: '5px' }}>
                  <span style={{ color: /[A-Z]/.test(formData.password) ? '#4ade80' : 'inherit' }}>
                    {/[A-Z]/.test(formData.password) ? '✓' : '•'} One uppercase letter (A-Z)
                  </span>
                </li>
                <li style={{ marginBottom: '5px' }}>
                  <span style={{ color: /[a-z]/.test(formData.password) ? '#4ade80' : 'inherit' }}>
                    {/[a-z]/.test(formData.password) ? '✓' : '•'} One lowercase letter (a-z)
                  </span>
                </li>
                <li style={{ marginBottom: '5px' }}>
                  <span style={{ color: /[0-9]/.test(formData.password) ? '#4ade80' : 'inherit' }}>
                    {/[0-9]/.test(formData.password) ? '✓' : '•'} One number (0-9)
                  </span>
                </li>
                <li style={{ marginBottom: '5px' }}>
                  <span style={{ color: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'\/`~]/.test(formData.password) ? '#4ade80' : 'inherit' }}>
                    {/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'\/`~]/.test(formData.password) ? '✓' : '•'} At least one special character
                  </span>
                </li>
                <li>
                  <span style={{ color: formData.password && formData.password === formData.confirmPassword && formData.password.length > 0 ? '#4ade80' : 'inherit' }}>
                    {formData.password && formData.password === formData.confirmPassword && formData.password.length > 0 ? '✓' : '•'} Passwords match
                  </span>
                </li>
              </ul>
            </div>
            
            <button type="submit" disabled={loading}>
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
          </form>
          <p className={styler.switch_text}>
            Already have an account? <Link href="/login">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
