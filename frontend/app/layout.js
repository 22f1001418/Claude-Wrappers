import Navbar from '@/app/components/Navbar'
import AppToastHost from '@/app/components/AppToastHost';
import { Poppins } from "next/font/google";
import "@/styles/globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "VyapaarAI",
  description: "AI-Powered Business Management Platform",
  icons: {
    icon: [
      { url: '/vectors/VyapaarAI (icon).png', sizes: '32x32', type: 'image/png' },
      { url: '/vectors/VyapaarAI (icon).png', sizes: '64x64', type: 'image/png' },
    ],
  },
};

export default function RootLayout({ children }) {
  const themeInitScript = `
    (function () {
      try {
        var savedTheme = localStorage.getItem('theme');
        var theme = savedTheme === 'light' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        document.body.style.background = theme === 'dark' ? '#0a0a0a' : '#faf8f5';
      } catch (e) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.style.background = '#0a0a0a';
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={poppins.variable} style={{ fontFamily: 'var(--font-poppins), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* <Navbar /> */}
        {children}
        <AppToastHost />
      </body>
    </html>
  );
}
