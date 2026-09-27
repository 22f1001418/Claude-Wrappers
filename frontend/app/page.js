"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/styles/page.module.css";
import Link from "next/link";
import Image from "next/image";
import ChatBot from "@/app/components/chatbot/ChatBot";
import { useSyncedTheme } from "@/lib/theme";

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const { darkMode, toggleTheme } = useSyncedTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const observerRefs = useRef([]);

  useEffect(() => {
    const syncAuthState = () => {
      const token = localStorage.getItem("access_token");
      const user = localStorage.getItem("user");
      setIsAuthenticated(Boolean(token || user));
    };

    syncAuthState();

    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };

    window.addEventListener("scroll", handleScroll);

    // Intersection Observer for scroll animations
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.visible);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -100px 0px" }
    );

    observerRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    window.addEventListener("storage", syncAuthState);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("storage", syncAuthState);
      observer.disconnect();
    };
  }, []);

  const addToRefs = (el) => {
    if (el && !observerRefs.current.includes(el)) {
      observerRefs.current.push(el);
    }
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <section className={styles.container} data-theme={darkMode ? 'dark' : 'light'}>
      {/* Navigation */}
      <nav className={`${styles.navWrapper} ${scrolled ? styles.navFloating : ""}`}>

        {/* MAIN BAR */}
        <div className={styles.navBar}>

          {/* LEFT LOGO */}
          <Link href="/" className={styles.logo}>
            <Image 
              src="/vectors/VyapaarAI (Transparent BG).png" 
              alt="VyaparAI Logo" 
              width={120} 
              height={40}
              style={{ objectFit: 'contain' }}
              priority
            />
          </Link>

          {/* CENTER LINKS (desktop) */}
          <div className={styles.navLinks}>
            <Link href="/">Home</Link>
            <a href="#">Tutorial</a>
            <Link href="/contact">Contact</Link>
          </div>

          {/* RIGHT */}
          <div className={styles.navRight}>

            {/* theme */}
            <button className={styles.themeToggle} onClick={toggleTheme}>
              {darkMode ? (<svg width="20" height="20" viewBox="0 0 20 20" fill="none"> <path d="M10 2.5V4M10 16V17.5M4 10H2.5M17.5 10H16M15.364 15.364L14.303 14.303M5.636 5.636L4.575 4.575M15.364 4.636L14.303 5.697M5.636 14.364L4.575 15.425M13 10C13 11.657 11.657 13 10 13C8.343 13 7 11.657 7 10C7 8.343 8.343 7 10 7C11.657 7 13 8.343 13 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> </svg>)
               :( <svg width="20" height="20" viewBox="0 0 20 20" fill="none"> <path d="M17.5 11.5C16.537 12.125 15.392 12.5 14.167 12.5C10.945 12.5 8.333 9.888 8.333 6.667C8.333 5.442 8.708 4.297 9.333 3.333C5.833 3.958 3.333 7.042 3.333 10.667C3.333 14.717 6.617 18 10.667 18C14.292 18 17.375 15.5 18 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> </svg> )
              }
            </button>

            {/* auth action */}
            <Link href={isAuthenticated ? "/dashboard" : "/login"} className={styles.signinBtn}>
              {isAuthenticated ? "Dashboard" : "Sign In"}
            </Link>

            {/* hamburger */}
            <button className={styles.hamburger} onClick={toggleMobileMenu}>
              ☰
            </button>
          </div>
        </div>

        {/* MOBILE FULL MENU */}
        <div className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.mobileOpen : ""}`}>

          {/* close button */}
          <div className={styles.mobileTop}>
            <div></div>
            <button onClick={toggleMobileMenu} className={styles.closeBtn}>✕</button>
          </div>

          <Link href="/">Home</Link>
          <a href="#">Tutorial</a>
          <Link href="/contact">Contact</Link>

          <Link href={isAuthenticated ? "/dashboard" : "/login"} className={styles.mobileSignin}>
            {isAuthenticated ? "Dashboard" : "Sign In"}
          </Link>

        </div>

      </nav>


      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            AI operations platform for modern retail
          </h1>
          <p className={styles.heroSubtitle}>
            Made by Team ENIGMA for the Software Engineering Project at IIT Madras
          </p>
          <Link href="/signup">
            <button className={styles.heroButton}>Sign Up</button>
          </Link>

          {/* Trusted By */}
          {/* <div className={styles.trustedBy}>
            <span>Trusted by retail businesses</span>
            <div className={styles.brandLogos}>
              <div className={styles.brandLogo}>ShopEase</div>
              <div className={styles.brandLogo}>RetailPro</div>
              <div className={styles.brandLogo}>StoreSync</div>
              <div className={styles.brandLogo}>TradeHub</div>
            </div>
          </div> */}
        </div>

        {/* Background gradient orb */}
        <div className={styles.heroOrb}></div>
      </section>

      {/* Tagline Section */}
      <section className={styles.taglineSection}>
        <div className={styles.taglineContent} ref={addToRefs}>
          <p className={styles.taglineText}>
            Transform complex operations into clear insights and confident
            decision-making.
          </p>
        </div>
      </section>

      {/* What is VyaparAI Section */}
      <section className={styles.missionSection}>
        <div className={styles.missionContent} ref={addToRefs}>
          <h2 className={styles.principlesMainTitle}>What is VyaपारAI?</h2>
          <p className={styles.featureDescription} style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', lineHeight: '1.8' }}>
            VyaपारAI is an intelligent operations platform designed for modern retail businesses. It helps small and medium shop owners manage billing, inventory, credit (udhaar), and daily operations from a single smart dashboard. Powered by AI, VyaपारAI can automatically detect products, track sales trends, predict inventory restocks, and provide real-time business insights — allowing shop owners to focus less on manual work and more on growing their business. Whether it's managing customers, understanding profits, or streamlining store operations, VyaपारAI acts as a digital brain for your shop.
          </p>
        </div>
      </section>

      {/* Purpose of VyaparAI Section */}
      <section className={styles.principlesSection}>
        <div className={styles.principlesContent} ref={addToRefs}>
          <h2 className={styles.principlesMainTitle}>What is the Purpose of VyaपारAI?</h2>
          <p className={styles.principlesSubtitle}>
            Empowering retail businesses with intelligent solutions for sustainable growth.
          </p>

          <div className={styles.principlesGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <div className={styles.principleCard}>
              <div className={styles.principleIcon}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect x="4" y="6" width="24" height="16" rx="2" stroke="#2c6e7e" strokeWidth="2" />
                  <path d="M8 10h16M8 14h12M8 18h8" stroke="#2c6e7e" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className={styles.principleTitle}>Simplify Shop Operations</h3>
              <p className={styles.principleDescription}>
                VyaपारAI centralizes billing, inventory, and credit management into one smart system, reducing manual work and daily operational confusion for shop owners.
              </p>
            </div>

            <div className={styles.principleCard}>
              <div className={styles.principleIcon}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect x="4" y="4" width="24" height="24" rx="4" stroke="#2c6e7e" strokeWidth="2" />
                  <path d="M8 16l4 4 8-8" stroke="#2c6e7e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className={styles.principleTitle}>Enable Data-Driven Decisions</h3>
              <p className={styles.principleDescription}>
                It provides real-time insights on sales, stock, and customer trends so business owners can make smarter decisions and improve profitability.
              </p>
            </div>

            <div className={styles.principleCard}>
              <div className={styles.principleIcon}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="12" stroke="#2c6e7e" strokeWidth="2" />
                  <path d="M12 8l8 8-8 8" stroke="#2c6e7e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className={styles.principleTitle}>Prepare Small Businesses for the Future</h3>
              <p className={styles.principleDescription}>
                VyaपारAI uses AI automation and predictions to help traditional retail shops become more efficient, scalable, and ready for digital growth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 1 - Source Correlation */}
      <section className={styles.featureSection}>
        <div className={styles.featureContent} ref={addToRefs}>
          <div className={styles.featureVisual}>
            <div className={styles.mockupWindow}>
              <div className={styles.windowHeader}>
                <div className={styles.windowDots}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div className={styles.windowContent}>
                <div className={styles.toolbarMock}>
                  <div className={styles.toolButton}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M11 11L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Analyze
                  </div>
                  <div className={styles.toolButton}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 8h12M8 2v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Track
                  </div>
                  <div className={styles.toolButton}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 3L13 13M3 13L13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Insights
                  </div>
                </div>
                <div className={styles.chatMock}>
                  <div className={styles.chatMessage}>Analyzing inventory trends...</div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.featureText}>
            <div className={styles.featureLabel}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M3 10h4m0 0V6m0 4v4m0-4h4m0 0V6m0 4v4m0-4h4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Smart Analytics
            </div>
            <h2 className={styles.featureTitle}>Real-Time Business Intelligence</h2>
            <p className={styles.featureDescription}>
              Track sales patterns, monitor inventory levels, and understand
              customer behavior with AI-powered analytics. Get actionable
              insights that help you make smarter decisions without manual data
              crunching.
            </p>
            <button className={styles.featureButton}>Learn More</button>
          </div>
        </div>
      </section>

      {/* Feature 2 - Report Generation */}
      <section className={styles.featureSection}>
        <div className={`${styles.featureContent} ${styles.featureReverse}`} ref={addToRefs}>
          <div className={styles.featureText}>
            <div className={styles.featureLabel}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Automated Operations
            </div>
            <h2 className={styles.featureTitle}>Streamlined Shop Management</h2>
            <p className={styles.featureDescription}>
              Centralize billing, inventory, and credit (udhaar) management into
              one smart system. Reduce manual work and operational confusion
              with intelligent automation that handles routine tasks for you.
            </p>
            <button className={styles.featureButton}>Learn More</button>
          </div>

          <div className={styles.featureVisual}>
            <div className={styles.mockupWindow}>
              <div className={styles.windowHeader}>
                <div className={styles.windowDots}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div className={styles.windowContent}>
                <div className={styles.reportPreview}>
                  <div className={styles.reportCard}>
                    <div className={styles.reportIcon}>
                      <img src="/vectors/icons8-sales-64.png" alt="Sales Report" />
                    </div>
                    <div className={styles.reportInfo}>
                      <div className={styles.reportTitle}>Sales Report</div>
                      <div className={styles.reportMeta}>Updated 2m ago</div>
                    </div>
                  </div>
                  <div className={styles.reportCard}>
                    <div className={styles.reportIcon}>
                      <img src="/vectors/icons8-inventory-50.png" alt="Inventory Status" />
                    </div>
                    <div className={styles.reportInfo}>
                      <div className={styles.reportTitle}>Inventory Status</div>
                      <div className={styles.reportMeta}>Real-time sync</div>
                    </div>
                  </div>
                  <div className={styles.reportCard}>
                    <div className={styles.reportIcon}>
                      <img src="/vectors/icons8-revenue-48.png" alt="Revenue Analytics" />
                    </div>
                    <div className={styles.reportInfo}>
                      <div className={styles.reportTitle}>Revenue Analytics</div>
                      <div className={styles.reportMeta}>Last 30 days</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3 - Research Analysis */}
      <section className={styles.featureSection}>
        <div className={styles.featureContent} ref={addToRefs}>
          <div className={styles.featureVisual}>
            <div className={styles.mockupWindow}>
              <div className={styles.windowHeader}>
                <div className={styles.windowDots}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div className={styles.windowContent}>
                <div className={styles.analysisView}>
                  <div className={styles.userThinking}>
                    <div className={styles.avatar}>AI</div>
                    <div className={styles.thinkingText}>Analyzing patterns...</div>
                  </div>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.featureText}>
            <div className={styles.featureLabel}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Predictive Intelligence
            </div>
            <h2 className={styles.featureTitle}>AI-Powered Forecasting</h2>
            <p className={styles.featureDescription}>
              Automatically detect products, predict inventory restocks, and
              identify sales trends before they happen. Let AI handle the
              complex analysis while you focus on growing your business.
            </p>
            <button className={styles.featureButton}>Learn More</button>
          </div>
        </div>
      </section>

      {/* Additional Feature Highlights */}
      <section className={styles.featureSection}>
        <div className={`${styles.featureContent} ${styles.businessAssistant}`} ref={addToRefs}>
          <div className={styles.featureText}>
            <div className={styles.featureLabel}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L12.09 8.26L18 10L12.09 11.74L10 18L7.91 11.74L2 10L7.91 8.26L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Digital Brain for Your Shop
            </div>
            <h2 className={styles.featureTitle}>Your Complete Business Assistant</h2>
            <p className={styles.featureDescription}>
              VyaपारAI serves as the intelligent backbone of your retail operation. From managing customer relationships to understanding profit margins, from tracking inventory to forecasting demand - it's like having a business expert working 24/7 to optimize every aspect of your shop. No more juggling multiple tools or losing track of important business metrics.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className={styles.featureCard}>
              <div className={styles.featureCardIcon}>
                <img src="/vectors/bullseye-arrow.svg" alt="Smart Targeting" />
              </div>
              <div>
                <h4 className={styles.featureCardTitle}>Smart Targeting</h4>
                <p className={styles.featureCardDescription}>Identify your best customers and products</p>
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureCardIcon}>
                <img src="/vectors/chart-donut.svg" alt="Growth Insights" />
              </div>
              <div>
                <h4 className={styles.featureCardTitle}>Growth Insights</h4>
                <p className={styles.featureCardDescription}>Discover opportunities for expansion</p>
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureCardIcon}>
                <img src="/vectors/update.svg" alt="Real-time Updates" />
              </div>
              <div>
                <h4 className={styles.featureCardTitle}>Real-time Updates</h4>
                <p className={styles.featureCardDescription}>Stay informed with instant notifications</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className={styles.missionSection}>
        <div className={styles.missionContent} ref={addToRefs}>
          <h2 className={styles.missionTitle}>
            From scattered tools to unified insights, we bring all your retail
            operations into one intelligent platform so you can grow without
            complexity.
          </h2>
        </div>
      </section>

      {/* Principles Section */}
      <section className={styles.principlesSection}>
        <div className={styles.principlesContent} ref={addToRefs}>
          <h2 className={styles.principlesMainTitle}>Built on Core Principles</h2>
          <p className={styles.principlesSubtitle}>
            Designed for small and medium retail shops with practical, everyday
            needs in mind.
          </p>

          <div className={styles.principlesGrid}>
            <div className={styles.principleCard}>
              <div className={styles.principleIcon}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect x="6" y="6" width="20" height="20" rx="4" stroke="#2c6e7e" strokeWidth="2" />
                  <path d="M12 16h8M16 12v8" stroke="#2c6e7e" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className={styles.principleTitle}>Simplicity First</h3>
              <p className={styles.principleDescription}>
                Built to be easy and intuitive so shop owners can manage their
                business without technical complexity.
              </p>
            </div>

            <div className={styles.principleCard}>
              <div className={styles.principleIcon}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="10" stroke="#2c6e7e" strokeWidth="2" />
                  <path d="M16 10v6l4 2" stroke="#2c6e7e" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className={styles.principleTitle}>Automation Over Manual Work</h3>
              <p className={styles.principleDescription}>
                Reduce repetitive tasks through smart automation in billing,
                inventory tracking, and reporting.
              </p>
            </div>

            <div className={styles.principleCard}>
              <div className={styles.principleIcon}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path d="M6 26L16 6l10 20H6z" stroke="#2c6e7e" strokeWidth="2" strokeLinejoin="round" />
                  <circle cx="16" cy="18" r="2" fill="#2c6e7e" />
                </svg>
              </div>
              <h3 className={styles.principleTitle}>Data-Driven Growth</h3>
              <p className={styles.principleDescription}>
                Provide clear insights and predictions to help businesses make
                informed decisions and increase profitability.
              </p>
            </div>

            <div className={styles.principleCard}>
              <div className={styles.principleIcon}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect x="4" y="8" width="10" height="18" rx="2" stroke="#2c6e7e" strokeWidth="2" />
                  <rect x="18" y="4" width="10" height="22" rx="2" stroke="#2c6e7e" strokeWidth="2" />
                </svg>
              </div>
              <h3 className={styles.principleTitle}>Built for Real Businesses</h3>
              <p className={styles.principleDescription}>
                Designed specifically for small and medium retail shops with
                practical, everyday operational needs in mind.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection} ref={addToRefs} style={{ position: 'relative' }}>
        <div className={styles.ctaBackgroundText}>
          VyaपारAI
        </div>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>Smart tools for smarter shops</h2>
          <p className={styles.ctaSubtitle}>
            Because every small business deserves big technology.
          </p>
          <div className={styles.ctaButtons}>
            <button className={styles.ctaSecondary}>Contact Us</button>
          </div>
        </div>
        <div className={styles.ctaOrb}></div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <div className={styles.footerLogo}>
              <Image 
                src="/vectors/VyapaarAI (Transparent BG).png" 
                alt="VyaparAI Logo" 
                width={140} 
                height={50}
                style={{ objectFit: 'contain' }}
              />
            </div>
            <p className={styles.footerTagline}>
              Intelligent operations, powered by AI.
            </p>
          </div>

          <div className={styles.footerLinks}>
            <div className={styles.footerColumn}>
              <h4>Features</h4>
              <a href="#">Smart Analytics</a>
              <a href="#">Inventory Management</a>
              <a href="#">Billing System</a>
              <a href="#">Credit Tracking</a>
            </div>

            <div className={styles.footerColumn}>
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Careers</a>
              <a href="#">Contact</a>
            </div>

            <div className={styles.footerColumn}>
              <h4>Resources</h4>
              <a href="#">Documentation</a>
              <a href="#">Help Center</a>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms</a>
            </div>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p>© 2024 VyaपारAI. All rights reserved.</p>
          <div className={styles.footerSocial}>
            <a href="#">Twitter</a>
            <a href="#">LinkedIn</a>
            <a href="#">Instagram</a>
          </div>
        </div>
      </footer>

      {/* ChatBot */}
      <ChatBot darkMode={darkMode} />
    </section>
  );
}