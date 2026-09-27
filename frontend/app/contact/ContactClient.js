"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "@/styles/page.module.css";
import { useSyncedTheme } from "@/lib/theme";

export default function ContactClient() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { darkMode, toggleTheme } = useSyncedTheme();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };

    const syncAuthState = () => {
      const token = localStorage.getItem("access_token");
      const user = localStorage.getItem("user");
      setIsAuthenticated(Boolean(token || user));
    };

    syncAuthState();
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("storage", syncAuthState);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("storage", syncAuthState);
    };
  }, []);

  return (
    <section className={styles.container} data-theme={darkMode ? "dark" : "light"}>
      <nav className={`${styles.navWrapper} ${scrolled ? styles.navFloating : ""}`}>
        <div className={styles.navBar}>
          <Link href="/" className={styles.logo}>
            <Image
              src="/vectors/VyapaarAI (Transparent BG).png"
              alt="VyaparAI Logo"
              width={120}
              height={40}
              style={{ objectFit: "contain" }}
              priority
            />
          </Link>

          <div className={styles.navLinks}>
            <Link href="/">Home</Link>
            <a href="#">Tutorial</a>
            <Link href="/contact">Contact</Link>
          </div>

          <div className={styles.navRight}>
            <button className={styles.themeToggle} onClick={toggleTheme}>
              {darkMode ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M10 2.5V4M10 16V17.5M4 10H2.5M17.5 10H16M15.364 15.364L14.303 14.303M5.636 5.636L4.575 4.575M15.364 4.636L14.303 5.697M5.636 14.364L4.575 15.425M13 10C13 11.657 11.657 13 10 13C8.343 13 7 11.657 7 10C7 8.343 8.343 7 10 7C11.657 7 13 8.343 13 10Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M17.5 11.5C16.537 12.125 15.392 12.5 14.167 12.5C10.945 12.5 8.333 9.888 8.333 6.667C8.333 5.442 8.708 4.297 9.333 3.333C5.833 3.958 3.333 7.042 3.333 10.667C3.333 14.717 6.617 18 10.667 18C14.292 18 17.375 15.5 18 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>

            <Link href={isAuthenticated ? "/dashboard" : "/login"} className={styles.signinBtn}>
              {isAuthenticated ? "Dashboard" : "Sign In"}
            </Link>

            <button className={styles.hamburger} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              ☰
            </button>
          </div>
        </div>

        <div className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.mobileOpen : ""}`}>
          <div className={styles.mobileTop}>
            <div></div>
            <button onClick={() => setMobileMenuOpen(false)} className={styles.closeBtn}>
              ✕
            </button>
          </div>

          <Link href="/">Home</Link>
          <a href="#">Tutorial</a>
          <Link href="/contact">Contact</Link>
          <Link href={isAuthenticated ? "/dashboard" : "/login"} className={styles.mobileSignin}>
            {isAuthenticated ? "Dashboard" : "Sign In"}
          </Link>
        </div>
      </nav>

      <main
        style={{
          minHeight: "calc(100vh - 110px)",
          display: "grid",
          placeItems: "center",
          padding: "2rem 1rem 3rem",
        }}
      >
        <section
          style={{
            width: "min(760px, 100%)",
            background: darkMode
              ? "linear-gradient(145deg, rgba(38, 70, 81, 0.74), rgba(31, 57, 66, 0.88))"
              : "linear-gradient(145deg, rgba(245, 251, 253, 0.96), rgba(230, 244, 247, 0.96))",
            color: darkMode ? "#eaf4f7" : "#0f2c34",
            border: darkMode
              ? "1px solid rgba(122, 198, 216, 0.3)"
              : "1px solid rgba(21, 96, 114, 0.22)",
            borderRadius: "18px",
            padding: "2rem",
            boxShadow: darkMode
              ? "0 14px 40px rgba(0, 0, 0, 0.3)"
              : "0 14px 36px rgba(20, 100, 118, 0.18)",
            backdropFilter: "blur(6px)",
          }}
        >
          <h1 style={{ margin: "0 0 0.75rem", fontSize: "2rem", lineHeight: 1.2 }}>Contact Us</h1>
          <p style={{ margin: "0 0 1.5rem", lineHeight: 1.75, opacity: 0.92 }}>
            Questions, feedback, or support requests? Reach out to Team ENIGMA and we will get back to you soon.
          </p>

          <div style={{ display: "grid", gap: "0.7rem", marginBottom: "1.6rem" }}>
            <p style={{ margin: 0 }}>
              <strong>Email:</strong> support@vyaparai.com
            </p>
            <p style={{ margin: 0 }}>
              <strong>Phone:</strong> +91-98765-43210
            </p>
            <p style={{ margin: 0 }}>
              <strong>Address:</strong> IIT Madras Campus, Chennai, India
            </p>
          </div>

          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "0.72rem 1.15rem",
              borderRadius: "10px",
              textDecoration: "none",
              fontWeight: 600,
              background: darkMode ? "#4dc8d8" : "#156072",
              color: darkMode ? "#082129" : "#f7fcfd",
            }}
          >
            Back to Home
          </Link>
        </section>
      </main>
    </section>
  );
}
