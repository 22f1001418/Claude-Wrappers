"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import UserChatBot from "@/app/components/chatbot/UserChatBot";
import DashboardNavbar from "@/app/components/Navbar";
import DashboardSidebar from "@/app/components/Sidebar";
import styles from "@/styles/dashboard.module.css";
import dynamic from 'next/dynamic';
import { fetchWithAuth, clearAuthStoragePreserveTheme } from "@/lib/auth";
import { getBackendUrl } from "@/lib/backend_url";
import { useSyncedTheme } from "@/lib/theme";

// Dynamically import Chart.js components to avoid SSR issues
const Line = dynamic(() => import('react-chartjs-2').then(mod => mod.Line), { ssr: false });
const Doughnut = dynamic(() => import('react-chartjs-2').then(mod => mod.Doughnut), { ssr: false });

// Register Chart.js components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

if (typeof window !== 'undefined') {
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
  );
}

export default function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { darkMode, toggleTheme } = useSyncedTheme();

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
      
      // Redirect cashier to inventory page
      if (userData.role === "cashier" && pathname === "/dashboard") {
        router.replace("/inventory");
        return;
      }
    } else {
      router.replace("/login");
    }

    setLoading(false);
  }, [router, pathname]);

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
        // If JWT invalid or expired
        clearAuthStoragePreserveTheme();
        alert("Session expired. Please login again.");
        router.replace("/login");
        return;
      }

      const data = await res.json();
      console.log("Profile Data:", data);

      router.push("/dashboard/profile");
    } catch (err) {
      console.error("Profile fetch error:", err);
      alert("Something went wrong");
    }
  }, [router]);

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

        {/* MAIN CONTENT - DASHBOARD PAGE */}
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
          {/* Render different dashboard based on user role */}
          {user.role === "admin" && <AdminDashboard darkMode={darkMode} toggleTheme={toggleTheme} />}
          {user.role === "cashier" && <CashierDashboard darkMode={darkMode} toggleTheme={toggleTheme} />}
          {(user.role === "owner" || user.role === "user") && <UserDashboard darkMode={darkMode} toggleTheme={toggleTheme} user={user} />}
        </div>
      </div>
    </div>
  );
}

// User Dashboard Component
function UserDashboard({ darkMode, toggleTheme, user }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetchWithAuth("http://localhost:5001/api/dashboard/stats", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        console.error('Failed to fetch dashboard data');
        return;
      }

      const result = await res.json();
      if (result.success) {
        // Add colors to payment methods with distinct colors
        const colorMap = {
          'Cash': '#ffa352',         // Orange
          'Credit': '#9b59b6',       // Purple
          'Upi': '#fcdc5a',          // Yellow
          'Card': '#2ecc71',         // Green
          'Credit card': '#9b59b6',  // Purple (fallback)
          'Debit card': '#2ecc71',   // Green (fallback)
          'Credit Card': '#9b59b6',  // Purple (fallback)
          'UPI': '#fcdc5a',          // Yellow (fallback)
          'Debit Card': '#2ecc71'    // Green (fallback)
        };
        
        const paymentMethodsWithColors = result.data.paymentMethods.map(method => ({
          ...method,
          color: colorMap[method.name] || '#999'
        }));
        
        setDashboardData({
          ...result.data,
          paymentMethods: paymentMethodsWithColors
        });
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const numericAmount = Number(String(amount).replace(/[^\d.-]/g, '')) || 0;
    return `₹${new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numericAmount)}`;
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  // Chart.js configuration for Revenue Overview
  const lineChartData = dashboardData ? {
    labels: dashboardData.revenueData.map(d => d.month),
    datasets: [
      {
        label: 'Revenue',
        data: dashboardData.revenueData.map(d => d.revenue),
        borderColor: '#ffa352',
        backgroundColor: 'rgba(255, 163, 82, 0.1)',
        tension: 0.4,
        fill: true,
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 8,
        pointHoverBackgroundColor: '#ffa352',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 3,
      },
      {
        label: 'Sales Count',
        data: dashboardData.revenueData.map(d => d.sales),
        borderColor: '#5cc88d',
        backgroundColor: 'rgba(92, 200, 141, 0.1)',
        tension: 0.4,
        fill: true,
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 8,
        pointHoverBackgroundColor: '#5cc88d',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 3,
      }
    ]
  } : null;

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: darkMode ? '#ffffff' : '#1a4a52',
        bodyColor: darkMode ? '#ffffff' : '#1a4a52',
        borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              if (context.datasetIndex === 0) {
                label += formatCurrency(context.parsed.y);
              } else {
                label += formatNumber(context.parsed.y);
              }
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          color: darkMode ? '#666' : '#9ba9b3',
          font: {
            size: 11
          }
        }
      },
      y: {
        grid: {
          color: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
          drawBorder: false
        },
        ticks: {
          color: darkMode ? '#666' : '#9ba9b3',
          font: {
            size: 11
          },
          callback: function(value) {
            return formatNumber(value);
          }
        }
      }
    }
  };

  // Chart.js configuration for Payment Methods Doughnut
  const doughnutChartData = dashboardData ? {
    labels: dashboardData.paymentMethods.map(m => m.name),
    datasets: [{
      data: dashboardData.paymentMethods.map(m => m.value),
      backgroundColor: dashboardData.paymentMethods.map(m => m.color),
      borderWidth: 0,
      cutout: '70%',
      hoverOffset: 10
    }]
  } : null;

  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: darkMode ? '#ffffff' : '#1a4a52',
        bodyColor: darkMode ? '#ffffff' : '#1a4a52',
        borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
          }
        }
      }
    }
  };

  if (loading || !dashboardData) {
    return (
      <div className={`${styles.loadingContainer} ${darkMode ? styles.dark : styles.light}`}>
        Loading dashboard data...
      </div>
    );
  }

  const totalRevenue = dashboardData.revenueData.reduce((sum, item) => sum + item.revenue, 0);
  const totalSalesCount = dashboardData.revenueData.reduce((sum, item) => sum + item.sales, 0);

  return (
    <>
      {/* TOP HEADER */}
      <div className={styles.dashboardHeader}>
        <h2 className={`${styles.dashboardTitle} ${darkMode ? styles.dark : styles.light}`}>Dashboard</h2>
      </div>

      {/* METRIC CARDS - 4 CARDS IN A ROW */}
      <div className={styles.metricsGrid}>
        {/* Total Sales Card */}
        <div className={`${styles.metricCard} ${darkMode ? styles.dark : styles.light}`}>
          <div className={styles.metricIconWrapper}>
            <div className={`${styles.metricIcon} ${styles.sales}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d4a549" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
          </div>
          <div className={`${styles.metricLabel} ${darkMode ? styles.dark : styles.light}`}>TOTAL SALES</div>
          <div className={`${styles.metricValue} ${darkMode ? styles.dark : styles.light}`}>
            {formatCurrency(dashboardData.totalSales)}
          </div>
          <div className={styles.metricGrowth}>
            <span className={dashboardData.salesGrowth >= 0 ? styles.growthPositive : styles.growthNegative}>
              {dashboardData.salesGrowth >= 0 ? '↑' : '↓'} {Math.abs(dashboardData.salesGrowth)}%
            </span>
            <span className={`${styles.growthLabel} ${darkMode ? styles.dark : styles.light}`}>vs last month</span>
          </div>
        </div>

        {/* Average Transaction Value Card */}
        <div className={`${styles.metricCard} ${darkMode ? styles.dark : styles.light}`}>
          <div className={styles.metricIconWrapper}>
            <div className={`${styles.metricIcon} ${styles.revenue}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5cc88d" strokeWidth="2">
                <line x1="6" y1="6" x2="20" y2="6"/>
                <line x1="6" y1="10" x2="20" y2="10"/>
                <path d="M6 6h4a5 5 0 0 1 0 10h-1"/>
                <line x1="10" y1="16" x2="17" y2="22"/>
              </svg>
            </div>
          </div>
          <div className={`${styles.metricLabel} ${darkMode ? styles.dark : styles.light}`}>AVG TRANSACTION VALUE</div>
          <div className={`${styles.metricValue} ${darkMode ? styles.dark : styles.light}`}>
            {formatCurrency(dashboardData.avgTransactionValue)}
          </div>
          <div className={styles.metricGrowth}>
            <span className={dashboardData.avgTransactionGrowth >= 0 ? styles.growthPositive : styles.growthNegative}>
              {dashboardData.avgTransactionGrowth >= 0 ? '↑' : '↓'} {Math.abs(dashboardData.avgTransactionGrowth)}%
            </span>
            <span className={`${styles.growthLabel} ${darkMode ? styles.dark : styles.light}`}>vs last month</span>
          </div>
        </div>

        {/* Total Units Sold Card */}
        <div className={`${styles.metricCard} ${darkMode ? styles.dark : styles.light}`}>
          <div className={styles.metricIconWrapper}>
            <div className={`${styles.metricIcon} ${styles.orders}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fcdc5a" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
          </div>
          <div className={`${styles.metricLabel} ${darkMode ? styles.dark : styles.light}`}>TOTAL UNITS SOLD</div>
          <div className={`${styles.metricValue} ${darkMode ? styles.dark : styles.light}`}>
            {formatNumber(dashboardData.totalUnitsSold)}
          </div>
          <div className={styles.metricGrowth}>
            <span className={dashboardData.unitsSoldGrowth >= 0 ? styles.growthPositive : styles.growthNegative}>
              {dashboardData.unitsSoldGrowth >= 0 ? '↑' : '↓'} {Math.abs(dashboardData.unitsSoldGrowth)}%
            </span>
            <span className={`${styles.growthLabel} ${darkMode ? styles.dark : styles.light}`}>vs last month</span>
          </div>
        </div>

        {/* Customers Card */}
        <div className={`${styles.metricCard} ${darkMode ? styles.dark : styles.light}`}>
          <div className={styles.metricIconWrapper}>
            <div className={`${styles.metricIcon} ${styles.customers}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#57d4f4" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
          </div>
          <div className={`${styles.metricLabel} ${darkMode ? styles.dark : styles.light}`}>CUSTOMERS</div>
          <div className={`${styles.metricValue} ${darkMode ? styles.dark : styles.light}`}>
            {formatNumber(dashboardData.customers)}
          </div>
          <div className={styles.metricGrowth}>
            <span className={dashboardData.customersGrowth >= 0 ? styles.growthPositive : styles.growthNegative}>
              {dashboardData.customersGrowth >= 0 ? '↑' : '↓'} {Math.abs(dashboardData.customersGrowth)}%
            </span>
            <span className={`${styles.growthLabel} ${darkMode ? styles.dark : styles.light}`}>vs last month</span>
          </div>
        </div>
      </div>

      {/* CHARTS ROW - Revenue Overview and Payment Methods */}
      <div className={styles.chartsGrid}>
        {/* Revenue Overview Chart */}
        <div className={`${styles.chartCard} ${darkMode ? styles.dark : styles.light}`}>
          <div className={styles.chartHeader}>
            <h3 className={`${styles.chartTitle} ${darkMode ? styles.dark : styles.light}`}>Revenue Overview</h3>
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColor} ${styles.revenue}`}></div>
                <span className={`${styles.legendLabel} ${darkMode ? styles.dark : styles.light}`}>Total Revenue</span>
                <span className={`${styles.legendValue} ${darkMode ? styles.dark : styles.light}`}>{formatCurrency(totalRevenue)}</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColor} ${styles.sales}`}></div>
                <span className={`${styles.legendLabel} ${darkMode ? styles.dark : styles.light}`}>Total Sales</span>
                <span className={`${styles.legendValue} ${darkMode ? styles.dark : styles.light}`}>{formatNumber(totalSalesCount)}</span>
              </div>
            </div>
          </div>
          
          {/* Chart.js Line Chart */}
          <div className={styles.chartContainer}>
            {lineChartData && <Line data={lineChartData} options={lineChartOptions} />}
          </div>
        </div>

        {/* Payment Methods Doughnut Chart */}
        <div className={`${styles.chartCard} ${darkMode ? styles.dark : styles.light}`}>
          <h3 className={`${styles.chartTitle} ${darkMode ? styles.dark : styles.light}`}>Payment Methods</h3>
          
          {/* Donut Chart */}
          <div className={styles.doughnutContainer}>
            {doughnutChartData && <Doughnut data={doughnutChartData} options={doughnutChartOptions} />}
            <div className={styles.doughnutCenter}>
              <div className={`${styles.doughnutLabel} ${darkMode ? styles.dark : styles.light}`}>Total</div>
              <div className={`${styles.doughnutValue} ${darkMode ? styles.dark : styles.light}`}>
                {formatCurrency(dashboardData.totalSales)}
              </div>
            </div>
          </div>
          
          {/* Legend */}
          <div className={styles.paymentLegend}>
            {dashboardData.paymentMethods.map((method, idx) => {
              const percentage = ((method.value / dashboardData.totalSales) * 100).toFixed(1);
              return (
                <div key={idx} className={styles.paymentLegendItem}>
                  <div className={styles.paymentLegendLeft}>
                    <div className={styles.paymentLegendColor} style={{ background: method.color }}></div>
                    <span className={`${styles.paymentLegendLabel} ${darkMode ? styles.dark : styles.light}`}>{method.name}</span>
                  </div>
                  <div className={styles.paymentLegendRight}>
                    <div className={`${styles.paymentLegendValue} ${darkMode ? styles.dark : styles.light}`}>
                      {formatCurrency(method.value)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* TABLES ROW - Recent Transactions and Top Products */}
      <div className={styles.tablesGrid}>
        {/* Recent Transactions */}
        <div className={`${styles.tableCard} ${darkMode ? styles.dark : styles.light}`}>
          <h3 className={`${styles.tableTitle} ${darkMode ? styles.dark : styles.light}`}>Recent Transactions</h3>
          
          <div className={styles.transactionsList}>
            {dashboardData.recentTransactions.length > 0 ? dashboardData.recentTransactions.map((transaction, idx) => (
              <div key={idx} className={`${styles.transactionItem} ${darkMode ? styles.dark : styles.light}`}>
                <div className={styles.transactionLeft}>
                  <div className={`${styles.transactionCustomer} ${darkMode ? styles.dark : styles.light}`}>
                    {transaction.customer}
                  </div>
                  <div className={`${styles.transactionDetails} ${darkMode ? styles.dark : styles.light}`}>
                    {transaction.id} • {transaction.date}
                  </div>
                </div>
                <div className={styles.transactionRight}>
                  <div className={`${styles.transactionAmount} ${darkMode ? styles.dark : styles.light}`}>
                    {formatCurrency(transaction.amount)}
                  </div>
                  <div className={`${styles.transactionStatus} ${styles[transaction.status]}`}>
                    {transaction.status}
                  </div>
                </div>
              </div>
            )) : (
              <div className={`${styles.emptyState} ${darkMode ? styles.dark : styles.light}`}>
                No recent transactions
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className={`${styles.tableCard} ${darkMode ? styles.dark : styles.light}`}>
          <h3 className={`${styles.tableTitle} ${darkMode ? styles.dark : styles.light}`}>Top Products</h3>
          
          <div className={styles.productsList}>
            {dashboardData.topProducts.length > 0 ? dashboardData.topProducts.map((product, idx) => (
              <div key={idx} className={`${styles.productItem} ${darkMode ? styles.dark : styles.light}`}>
                <div className={styles.productLeft}>
                  <div className={`${styles.productRank} ${styles[`rank${idx + 1}`]}`}>
                    {idx + 1}
                  </div>
                  <div>
                    <div className={`${styles.productName} ${darkMode ? styles.dark : styles.light}`}>
                      {product.name}
                    </div>
                    <div className={`${styles.productQuantity} ${darkMode ? styles.dark : styles.light}`}>
                      {product.quantity} units sold
                    </div>
                  </div>
                </div>
                <div className={`${styles.productSales} ${darkMode ? styles.dark : styles.light}`}>
                  {formatCurrency(product.sales)}
                </div>
              </div>
            )) : (
              <div className={`${styles.emptyState} ${darkMode ? styles.dark : styles.light}`}>
                No product data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Chatbot */}
      <UserChatBot darkMode={darkMode} username={user?.username || "user"} />
    </>
  );
}

// Admin Dashboard Component


function AdminDashboard({ darkMode }) {
  const [data, setData] = useState(null);

  const theme = darkMode
    ? {
      pageText: "#f3f4f6",
      mutedText: "#cbd5e1",
      cardBg: "#121212",
      cardBorder: "1px solid rgba(148, 163, 184, 0.28)",
      tableBorder: "1px solid rgba(148, 163, 184, 0.22)",
      headerBg: "#1a1a1a",
      inputBg: "#121212",
      inputBorder: "1px solid rgba(148, 163, 184, 0.45)",
      inputText: "#f8fafc"
    }
    : {
      pageText: "#0f172a",
      mutedText: "#334155",
      cardBg: "#ffffff",
      cardBorder: "1px solid rgba(15, 23, 42, 0.12)",
      tableBorder: "1px solid rgba(15, 23, 42, 0.1)",
      headerBg: "#f1f5f9",
      inputBg: "#ffffff",
      inputBorder: "1px solid rgba(15, 23, 42, 0.2)",
      inputText: "#0f172a"
    };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const url = await getBackendUrl();
      const token = localStorage.getItem("access_token");

      const res = await fetch(`${url}/api/dashboard/admin-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error("Failed to fetch admin data");
      }

      const result = await res.json();

      setData(result.data); // ✅ IMPORTANT FIX
    } catch (err) {
      console.error("Admin fetch error:", err);
    }
  };

  if (!data) {
    return (
      <div style={{ padding: "40px", color: theme.pageText }}>
        Loading Admin Dashboard...
      </div>
    );
  }

  return (
    <>
      {/* HEADER */}
      <h2 style={{ color: theme.pageText }}>
        Admin Dashboard
      </h2>

      {/* ========================= */}
      {/* TOP METRICS */}
      {/* ========================= */}
      <div style={{
        marginTop: "20px",
        display: "grid",
        gridTemplateColumns: "repeat(4,1fr)",
        gap: "20px"
      }}>
        <Card title="Total Users" value={data.totalUsers} darkMode={darkMode} theme={theme} />
        <Card title="Owners" value={data.totalOwners} darkMode={darkMode} theme={theme} />
        <Card title="Cashiers" value={data.totalCashiers} darkMode={darkMode} theme={theme} />
        <Card title="Products" value={data.totalProducts} darkMode={darkMode} theme={theme} />
      </div>

      {/* ========================= */}
      {/* PLATFORM ANALYTICS */}
      {/* ========================= */}
      <div style={{
        marginTop: "40px",
        display: "grid",
        gridTemplateColumns: "repeat(3,1fr)",
        gap: "20px"
      }}>
        <Card title="Total Revenue" value={`₹${data.totalSales}`} darkMode={darkMode} theme={theme} />
        <Card title="Transactions" value={data.totalTransactions} darkMode={darkMode} theme={theme} />
        <Card title="Inventories" value={data.totalInventories} darkMode={darkMode} theme={theme} />
      </div>

      {/* ========================= */}
      {/* ROLE DISTRIBUTION CHART */}
      {/* ========================= */}
      <div style={{
        marginTop: "40px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "30px"
      }}>

        {/* ========================= */}
        {/* LEFT: TOP OWNERS */}
        {/* ========================= */}
        <div style={{
          background: theme.cardBg,
          color: theme.pageText,
          border: theme.cardBorder,
          padding: "20px",
          borderRadius: "12px"
        }}>
          <h3 style={{ color: theme.pageText }}>Top Performing Owners</h3>

          {data.topOwners && data.topOwners.length > 0 ? (
            data.topOwners.map((owner, index) => (
              <div key={index} style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: theme.tableBorder,
                color: theme.pageText
              }}>
                <div>
                  {index + 1}. {owner.owner}
                </div>

                <div style={{ fontWeight: "bold", color: theme.pageText }}>
                  ₹{owner.sales}
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: theme.mutedText }}>No data available</p>
          )}
        </div>

        {/* ========================= */}
        {/* RIGHT: DOUGHNUT */}
        {/* ========================= */}
        <div style={{
          background: theme.cardBg,
          color: theme.pageText,
          border: theme.cardBorder,
          padding: "20px",
          borderRadius: "12px"
        }}>
          <h3 style={{ color: theme.pageText }}>User Role Distribution</h3>

          <div style={{
            height: "280px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}>
            <Doughnut
              data={{
                labels: ["Owners", "Cashiers", "Admins"],
                datasets: [{
                  data: [
                    data.totalOwners,
                    data.totalCashiers,
                    data.admins?.length || 0
                  ],
                  backgroundColor: ["#ffa352", "#5cc88d", "#57d4f4"]
                }]
              }}
              options={{
                maintainAspectRatio: false,
                cutout: "70%",
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: {
                      color: theme.pageText
                    }
                  }
                }
              }}
            />
          </div>
        </div>

      </div>

      {/* ========================= */}
      {/* USER MANAGEMENT */}
      {/* ========================= */}
      <div style={{ marginTop: "40px" }}>
        <h3 style={{ color: theme.pageText }}>User Management</h3>

        <UserSection
          title="All Users"
          users={[...(data.owners || []), ...(data.cashiers || [])]}
          darkMode={darkMode}
          theme={theme}
        />
      </div>
    </>
  );
}

function Card({ title, value, darkMode, theme }) {
  return (
    <div
      style={{
        background: theme.cardBg,
        color: theme.pageText,
        border: theme.cardBorder,
        padding: "20px",
        borderRadius: "12px",
        textAlign: "center",
        boxShadow: darkMode
          ? "0 5px 15px rgba(0,0,0,0.4)"
          : "0 5px 15px rgba(0,0,0,0.08)"
      }}
    >
      <div style={{ fontSize: "14px", color: theme.mutedText }}>{title}</div>
      <div style={{ fontSize: "28px", fontWeight: "bold", color: theme.pageText }}>{value}</div>
    </div>
  );
}

function UserSection({ title, users = [], darkMode, theme }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // ✅ Safe filtering (NO CRASH, NO ROLE SEARCH)
  const filteredUsers = users.filter((u) => {
    const name = (u.name || "").toLowerCase();
    const username = (u.username || "").toLowerCase();
    const searchText = search.toLowerCase();

    // ✅ Search ONLY name + username
    const matchesSearch =
      name.includes(searchText) ||
      username.includes(searchText);

    // ✅ Role filter FIXED (handles "user" as owner)
    const matchesRole =
      roleFilter === "all"
        ? true
        : roleFilter === "owner"
          ? u.role === "owner" || u.role === "user"
          : u.role === "cashier";

    return matchesSearch && matchesRole;
  });

  return (
    <div
      style={{
        marginTop: "30px",
        background: theme.cardBg,
        color: theme.pageText,
        padding: "20px",
        borderRadius: "12px",
        border: theme.cardBorder,
        boxShadow: darkMode
          ? "0 5px 15px rgba(0,0,0,0.4)"
          : "0 4px 12px rgba(0,0,0,0.05)"
      }}
    >
      {/* HEADER */}
      <h4 style={{ marginBottom: "15px", color: theme.pageText }}>{title}</h4>

      {/* 🔍 SEARCH + FILTER */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px"
        }}
      >
        <input
          placeholder="Search by name or username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: "8px",
            border: theme.inputBorder,
            background: theme.inputBg,
            color: theme.inputText,
            outline: "none"
          }}
        />

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: theme.inputBorder,
            background: theme.inputBg,
            color: theme.inputText
          }}
        >
          <option value="all">All Roles</option>
          <option value="owner">Shop Owner</option>
          <option value="cashier">Cashier</option>
        </select>
      </div>

      {/* 📊 TABLE */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse"
          }}
        >
          <thead>
            <tr
              style={{
                textAlign: "left",
                background: theme.headerBg,
                borderBottom: theme.tableBorder
              }}
            >
              <th style={{ padding: "10px", color: theme.pageText }}>Name</th>
              <th style={{ padding: "10px", color: theme.pageText }}>Username</th>
              <th style={{ padding: "10px", color: theme.pageText }}>Role</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ padding: "15px", textAlign: "center", color: theme.mutedText }}>
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((u, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: theme.tableBorder,
                    color: theme.pageText
                  }}
                >
                  <td style={{ padding: "10px" }}>
                    {u.name || u.username}
                  </td>

                  <td style={{ padding: "10px", color: theme.mutedText }}>
                    @{u.username}
                  </td>

                  <td style={{ padding: "10px" }}>
                    {u.role === "owner" || u.role === "user"
                      ? "Shop Owner"
                      : "Cashier"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}



// Cashier Dashboard Component
function CashierDashboard({ darkMode, toggleTheme }) {
  return (
    <>
      {/* TOP HEADER */}
      <div style={{ marginBottom: "30px" }}>
        <h2 style={{ color: darkMode ? '#ffffff' : '#1a4a52' }}>Cashier Dashboard</h2>
      </div>

      {/* DASHBOARD CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "30px",
        }}
      >
        {/* Billing Counter Card */}
        <div
          style={{
            background: darkMode ? "#1a1a1a" : "#ffffff",
            color: darkMode ? "#ffffff" : "#1a4a52",
            padding: "30px",
            borderRadius: "15px",
            minHeight: "180px",
            border: darkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(44, 110, 126, 0.15)',
            boxShadow: darkMode ? "0 5px 20px rgba(0,0,0,0.4)" : "0 5px 20px rgba(44, 110, 126, 0.12)",
            transition: "all 0.3s ease"
          }}
        >
          <h3 style={{ color: darkMode ? '#ffffff' : '#1a4a52' }}>🧾 Billing Counter</h3>
          <p style={{ marginTop: "10px", color: darkMode ? "#a0a0a0" : "#6b8a93" }}>
            Create and manage customer bills.
          </p>
        </div>
        {/* Manual Billing Counter Card */}
        <div
          style={{
            background: darkMode ? "#1a1a1a" : "#ffffff",
            color: darkMode ? "#ffffff" : "#1a4a52",
            padding: "30px",
            borderRadius: "15px",
            minHeight: "180px",
            border: darkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(44, 110, 126, 0.15)',
            boxShadow: darkMode ? "0 5px 20px rgba(0,0,0,0.4)" : "0 5px 20px rgba(44, 110, 126, 0.12)",
            transition: "all 0.3s ease"
          }}
        >
          <h3 style={{ color: darkMode ? '#ffffff' : '#1a4a52' }}>🧾 Manual Billing Counter</h3>
          <p style={{ marginTop: "10px", color: darkMode ? "#a0a0a0" : "#6b8a93" }}>
            Create and manage customer bills.
          </p>
        </div>

        {/* Inventory Card */}
        <div
          style={{
            background: darkMode ? "#1a1a1a" : "#ffffff",
            color: darkMode ? "#ffffff" : "#1a4a52",
            padding: "30px",
            borderRadius: "15px",
            minHeight: "180px",
            border: darkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(44, 110, 126, 0.15)',
            boxShadow: darkMode ? "0 5px 20px rgba(0,0,0,0.4)" : "0 5px 20px rgba(44, 110, 126, 0.12)",
            transition: "all 0.3s ease"
          }}
        >
          <h3 style={{ color: darkMode ? '#ffffff' : '#1a4a52' }}>📦 Inventory</h3>
          <p style={{ marginTop: "10px", color: darkMode ? "#a0a0a0" : "#6b8a93" }}>
            View available products and stock levels.
          </p>
        </div>

        {/* Recent Transactions */}
        <div
          style={{
            gridColumn: "1 / -1",
            background: darkMode ? "#1a1a1a" : "#ffffff",
            color: darkMode ? "#ffffff" : "#1a4a52",
            padding: "30px",
            borderRadius: "15px",
            minHeight: "250px",
            border: darkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(44, 110, 126, 0.15)',
            boxShadow: darkMode ? "0 5px 20px rgba(0,0,0,0.4)" : "0 5px 20px rgba(44, 110, 126, 0.12)",
            transition: "all 0.3s ease"
          }}
        >
          <h3 style={{ color: darkMode ? '#ffffff' : '#1a4a52' }}>Recent Transactions</h3>
        </div>
      </div>
    </>
  );
}
