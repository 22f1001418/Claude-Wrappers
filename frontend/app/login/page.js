"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styler from "@/styles/login.module.css";
import Link from "next/link";
import { getBackendUrl } from "@/lib/backend_url";
import { emitErrorToast, emitSuccessToast } from "@/lib/toast";
import { useSyncedTheme } from "@/lib/theme";

export default function Login() {
  const { darkMode } = useSyncedTheme();
  const [formData, setFormData] = useState({
    username_or_email: "",
    password: ""
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
      setError("Google login failed. No credential was returned.");
      emitErrorToast("Google login failed. No credential was returned.");
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
        throw new Error(data.error || "Google sign-in failed");
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      emitSuccessToast(`Welcome back, ${data?.user?.username || "user"}`);
      router.push("/dashboard");
    } catch (err) {
      const message = err.message || "Google sign-in failed. Please try again.";
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
    setLoading(true);

    try {
      const url = await getBackendUrl();
      const response = await fetch(`${url}/api/auth/signin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store tokens in localStorage
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      emitSuccessToast(`Login successful! Welcome back, ${data?.user?.username || "user"}`);

      // Redirect to dashboard (same route for all roles)
      router.push("/dashboard");

    } catch (err) {
      const message = err.message || "Login failed. Please try again.";
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
            src="/vectors/undraw_complete-form_aarh.svg"
            alt="Login Image"
            width={500}
            height={500}
          />
        </div>
        <div className={styler.text}>
          <h2>Sign In to your account</h2>
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
              name="username_or_email"
              placeholder="Username or Email" 
              value={formData.username_or_email}
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
            <button type="submit" disabled={loading}>
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
          <p className={styler.switch_text}>
            Don't have an account? <Link href="/signup">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
