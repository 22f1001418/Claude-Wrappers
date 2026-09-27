"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import DashboardNavbar from "@/app/components/Navbar";
import DashboardSidebar from "@/app/components/Sidebar";
import UserChatBot from "@/app/components/chatbot/UserChatBot";
import { fetchWithAuth } from "@/lib/auth";
import styles from "@/styles/dashboard.module.css";
import { useSyncedTheme } from "@/lib/theme";

const Line = dynamic(() => import("react-chartjs-2").then(mod => mod.Line), { ssr: false });
const Doughnut = dynamic(() => import("react-chartjs-2").then(mod => mod.Doughnut), { ssr: false });

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from "chart.js";

if (typeof window !== "undefined") {
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Tooltip,
    Legend,
    Filler
  );
}

export default function CreditPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { darkMode, toggleTheme } = useSyncedTheme();
  const [creditData, setCreditData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    setUser(JSON.parse(localStorage.getItem("user")));
    fetchCreditData();
  }, []);

  const fetchCreditData = async () => {
    try {
      const res = await fetchWithAuth("http://localhost:5001/api/credits/dashboard");
      const data = await res.json();
      if (data.success) setCreditData(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 60 }}>Loading...</div>;
  if (!creditData) return <div style={{ padding: 60 }}>No data available</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <DashboardNavbar darkMode={darkMode} toggleTheme={toggleTheme} user={user} />
      <div style={{ display: "flex", marginTop: "70px", color: "var(--text-primary)" }}>
        <DashboardSidebar darkMode={darkMode} user={user} />

        <div style={{ marginLeft: "250px", flex: 1, padding: "40px", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
          <CreditDashboard
            darkMode={darkMode}
            creditData={creditData}
            refresh={fetchCreditData}
          />
          <UserChatBot darkMode={darkMode} user={user} />
        </div>
      </div>
    </div>
  );
}

function CreditDashboard({ darkMode, creditData, refresh }) {

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0
    }).format(amount || 0);

  const trend = creditData.trend || [];
  const customers = creditData.customers || [];

  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilterType, setDateFilterType] = useState("purchase");
  const [dateFilterValue, setDateFilterValue] = useState("");
  const [filteredCustomers, setFilteredCustomers] = useState(
    customers.filter(c => c.amount_remaining > 0)
  );
  const [editingId, setEditingId] = useState(null);
  const [additionalPayment, setAdditionalPayment] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  // Invoice modal states
  const [invoiceData, setInvoiceData] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    setFilteredCustomers(
      customers.filter((c) => {
        if (c.amount_remaining <= 0) return false;

        const matchesSearch =
          !normalizedQuery ||
          String(c.customer_name || "").toLowerCase().includes(normalizedQuery) ||
          String(c.customer_phone || "").toLowerCase().includes(normalizedQuery) ||
          String(c.total_cost || "").toLowerCase().includes(normalizedQuery) ||
          String(c.amount_paid || "").toLowerCase().includes(normalizedQuery) ||
          String(c.amount_remaining || "").toLowerCase().includes(normalizedQuery);

        const purchaseDate = String(c.date_of_purchase || "");
        const dueDate = String(c.due_date || "");

        const matchesDate =
          !dateFilterValue ||
          (dateFilterType === "purchase" && purchaseDate === dateFilterValue) ||
          (dateFilterType === "due" && dueDate === dateFilterValue);

        return matchesSearch && matchesDate;
      })
    );
  }, [searchQuery, dateFilterType, dateFilterValue, customers]);

  const handleClearCredit = async (sale_id, remainingAmount) => {
    try {
      const isPartial =
        parseFloat(additionalPayment) < parseFloat(remainingAmount);

      const res = await fetchWithAuth(
        `http://localhost:5001/api/credits/clear/${sale_id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount_paid: additionalPayment,
            new_due_date: isPartial ? newDueDate : null
          })
        }
      );

      const data = await res.json();

      if (data.success) {
        const cust = customers.find(c => c.sale_id === sale_id);
        const isFullPayment = parseFloat(additionalPayment) >= parseFloat(cust.amount_remaining);

        // Set invoice data
        setInvoiceData({
          customer_name: cust.customer_name,
          customer_phone: cust.customer_phone,
          date_of_purchase: cust.date_of_purchase,
          due_date: cust.due_date,
          total_cost: cust.total_cost,
          amount_paid: isFullPayment ? cust.total_cost : additionalPayment,
          amount_remaining: isFullPayment ? "Cleared" : (cust.amount_remaining - additionalPayment),
          payment_type: isFullPayment ? "Full Payment" : "Partial Payment",
          timestamp: new Date().toLocaleString()
        });

        setShowInvoice(true);
        setEditingId(null);
        setAdditionalPayment("");
        setNewDueDate("");
        refresh();
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const totalOutstanding = creditData.totalOutstanding || 0;
  const overdue = creditData.overdue || 0;

  const overduePercent =
    totalOutstanding > 0
      ? ((overdue / totalOutstanding) * 100).toFixed(1)
      : 0;

  const riskLevel =
    overduePercent > 40
      ? "High Risk"
      : overduePercent > 20
      ? "Medium Risk"
      : "Low Risk";

  const chartTextColor = darkMode ? "#ffffff" : "#1a4a52";
  const chartGridColor = darkMode ? "rgba(255,255,255,0.08)" : "rgba(44,110,126,0.12)";

  const paymentStatusData = {
    labels: ["Fully Paid", "Partially Paid", "Unpaid"],
    datasets: [
      {
        data: [
          creditData.fullyPaid || 0,
          creditData.partial || 0,
          creditData.unpaid || 0
        ],
        backgroundColor: ["#2ecc71", "#f39c12", "#e74c3c"],
        borderWidth: 0,
        cutout: "70%"
      }
    ]
  };

  const doughnutOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: chartTextColor
        }
      }
    }
  };

  const lineData = {
    labels: trend.map((d) => d.month),
    datasets: [
      {
        label: "Pending Money",
        data: trend.map((d) => d.amount),
        borderColor: "#ffa352",
        backgroundColor: "rgba(255,163,82,0.08)",
        fill: true,
        tension: 0.4
      }
    ]
  };

  const lineOptions = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: chartTextColor
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: chartTextColor
        },
        grid: {
          color: chartGridColor
        }
      },
      y: {
        ticks: {
          color: chartTextColor
        },
        grid: {
          color: chartGridColor
        }
      }
    }
  };

  return (
    <>
      <div className={styles.dashboardHeader}>
        <h2 className={`${styles.dashboardTitle} ${darkMode ? styles.dark : styles.light}`}>
          Customer Credit Overview
        </h2>
      </div>

      <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
        <MetricCard
          title="Total Money Yet to Receive"
          value={formatCurrency(totalOutstanding)}
          icon="money"
          darkMode={darkMode}
        />
        <MetricCard
          title="Risk Level"
          value={riskLevel}
          icon="warning"
          darkMode={darkMode}
        />
      </div>

      <div
        className={`${styles.tableCard} ${darkMode ? styles.dark : styles.light}`}
        style={{
          width: "100%",
          marginBottom: "40px",
          maxHeight: "450px",
          overflowY: "auto",
          padding: "20px"
        }}
      >
        <h3 className={`${styles.tableTitle} ${darkMode ? styles.dark : styles.light}`}>Customers Needing Follow-up</h3>

        <div style={{ display: "flex", gap: "10px", marginBottom: "15px", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search by name or number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "45%",
              padding: "10px",
              borderRadius: "8px",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-color)"
            }}
          />

          <select
            value={dateFilterType}
            onChange={(e) => setDateFilterType(e.target.value)}
            style={{
              width: "22%",
              padding: "10px",
              borderRadius: "8px",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-color)"
            }}
          >
            <option value="purchase">Purchase Date</option>
            <option value="due">Due Date</option>
          </select>

          <input
            type="date"
            value={dateFilterValue}
            onChange={(e) => setDateFilterValue(e.target.value)}
            style={{
              width: "22%",
              padding: "10px",
              borderRadius: "8px",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-color)"
            }}
          />

          <button
            onClick={() => {
              setSearchQuery("");
              setDateFilterValue("");
              setDateFilterType("purchase");
            }}
            style={{
              width: "11%",
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background: "var(--table-header-bg)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontWeight: "600"
            }}
          >
            Clear
          </button>
        </div>

        {filteredCustomers.map((cust) => (
          <div key={cust.sale_id} style={{ marginBottom: "20px" }}>
            <div className={`${styles.transactionItem} ${darkMode ? styles.dark : styles.light}`}>
              <div>
                <div className={`${styles.transactionCustomer} ${darkMode ? styles.dark : styles.light}`}>
                  {cust.customer_name}
                </div>
                <div
                  className={`${styles.transactionDetails} ${darkMode ? styles.dark : styles.light}`}
                  style={{
                    display: "flex",
                    flexWrap: "nowrap",
                    gap: "15px",
                    fontSize: "12px",
                    opacity: 0.95,
                    color: darkMode ? "#cfd9de" : "#5f7f87",
                    marginTop: "6px",
                    alignItems: "center"
                  }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
                      <Image src="/vectors/contact.png" alt="Phone" width={14} height={14} style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }} />
                      <span>{cust.customer_phone || "No phone"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
                      <Image src="/vectors/purchasE_due_date.png" alt="Purchase date" width={14} height={14} style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }} />
                      <span>Purchase Date: {cust.date_of_purchase || "-"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
                      <Image src="/vectors/purchasE_due_date.png" alt="Due date" width={14} height={14} style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }} />
                      <span>Due Date: {cust.due_date || "-"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
                      <Image src="/vectors/total.png" alt="Total" width={14} height={14} style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }} />
                      <span>Total: ₹ {cust.total_cost}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
                      <Image src="/vectors/money_to_receive.png" alt="Amount paid" width={14} height={14} style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }} />
                      <span>Amount Paid: ₹ {cust.amount_paid}</span>
                    </div>
                  </div>
                </div>

              <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                <div style={{ color: "#e74c3c", fontWeight: "bold" }}>
                  {formatCurrency(cust.amount_remaining)}
                </div>

                <button
                  onClick={() => setEditingId(cust.sale_id)}
                  style={{
                    padding: "6px 10px",
                    background: "var(--accent-gradient)",
                    border: "none",
                    color: "white",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  Clear Credit
                </button>
              </div>
            </div>

            {editingId === cust.sale_id && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "15px",
                  borderRadius: "8px",
                  background: "var(--card-bg)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  maxWidth: "400px"
                }}
              >
                <div style={{ marginBottom: "5px", fontWeight: "600" }}>
                  Enter Additional Payment
                </div>
                <input
                  type="number"
                  value={additionalPayment}
                  onChange={(e) => setAdditionalPayment(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    marginBottom: "15px",
                    borderRadius: "6px"
                    ,
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-color)"
                  }}
                />

                {parseFloat(additionalPayment) > 0 &&
                 parseFloat(additionalPayment) < parseFloat(cust.amount_remaining) && (
                  <>
                    <div style={{ marginBottom: "5px", fontWeight: "600" }}>
                      Enter New Due Date
                    </div>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        marginBottom: "15px",
                        borderRadius: "6px",
                        background: "var(--input-bg)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-color)"
                      }}
                    />
                  </>
                )}

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() =>
                      handleClearCredit(cust.sale_id, cust.amount_remaining)
                    }
                    style={{
                      padding: "6px 12px",
                      background: "#2ecc71",
                      border: "none",
                      color: "white",
                      borderRadius: "6px"
                    }}
                  >
                    Save
                  </button>

                  <button
                    onClick={() => setEditingId(null)}
                    style={{
                      padding: "6px 12px",
                      background: "#e74c3c",
                      border: "none",
                      color: "white",
                      borderRadius: "6px"
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Invoice Modal */}
      {showInvoice && invoiceData && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
          onClick={() => setShowInvoice(false)}
        >
          <div
            style={{
              background: "var(--card-bg)",
              padding: "30px",
              borderRadius: "12px",
              width: "400px",
              color: "var(--text-primary)",
              position: "relative",
              border: "1px solid var(--border-color)",
              boxShadow: "var(--card-shadow)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: "20px" }}>Invoice</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Image src="/vectors/customer_details.png" alt="Customer" width={20} height={20} style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }} />
                <span>Customer: {invoiceData.customer_name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Image src="/vectors/contact.png" alt="Phone" width={20} height={20} style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }} />
                <span>Phone: {invoiceData.customer_phone || "-"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Image src="/vectors/calendar.png" alt="Purchase Date" width={20} height={20} style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }} />
                <span>Purchase Date: {invoiceData.date_of_purchase || "-"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Image src="/vectors/calendar.png" alt="Due Date" width={20} height={20} style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }} />
                <span>Due Date: {invoiceData.due_date || "-"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Image src="/vectors/total.png" alt="Total Cost" width={20} height={20} style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }} />
                <span>Total Cost: ₹ {invoiceData.total_cost}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Image src="/vectors/money_to_receive.png" alt="Amount Paid" width={20} height={20} style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }} />
                <span>Amount Paid: ₹ {invoiceData.amount_paid}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Image src="/vectors/money_to_receive.png" alt="Remaining" width={20} height={20} style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }} />
                <span>
                  {typeof invoiceData.amount_remaining === "number"
                    ? `Remaining: ₹ ${invoiceData.amount_remaining}`
                    : `Remaining: ${invoiceData.amount_remaining}`}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Image src="/vectors/payment_type.png" alt="Payment Type" width={20} height={20} style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }} />
                <span>Payment Type: {invoiceData.payment_type}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Image src="/vectors/timestamp.png" alt="Timestamp" width={20} height={20} style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }} />
                <span>Timestamp: {invoiceData.timestamp}</span>
              </div>
            </div>
            <button
              style={{
                marginTop: "20px",
                padding: "8px 12px",
                background: "var(--accent-gradient)",
                border: "none",
                color: "#fff",
                borderRadius: "6px",
                cursor: "pointer"
              }}
              onClick={() => setShowInvoice(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {trend.length > 0 && (
        <div style={{ display: "flex", gap: "30px", marginBottom: "40px" }}>
          <div className={`${styles.chartCard} ${darkMode ? styles.dark : styles.light}`} style={{ flex: 1 }}>
            <h3 className={`${styles.chartTitle} ${darkMode ? styles.dark : styles.light}`}>Pending Money Over Last 6 Months</h3>
            <Line data={lineData} options={lineOptions} />
          </div>

          <div className={`${styles.chartCard} ${darkMode ? styles.dark : styles.light}`} style={{ flex: 1 }}>
            <h3 className={`${styles.chartTitle} ${darkMode ? styles.dark : styles.light}`}>Payment Status Overview</h3>
            <div style={{ height: "320px" }}>
              <Doughnut data={paymentStatusData} options={doughnutOptions} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MetricCard({ title, value, icon, darkMode }) {
  const icons = {
    money: "/vectors/money_to_receive.png",
    warning: "/vectors/not_sold(15 days).png"
  };

  return (
    <div
      className={`${styles.metricCard} ${darkMode ? styles.dark : styles.light}`}
      style={{ flex: 1, minWidth: "220px", padding: "20px" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "14px" }}>
        <div style={{ width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Image
            src={icons[icon]}
            alt={title}
            width={44}
            height={44}
            style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }}
          />
        </div>
        <div
          className={`${styles.metricLabel} ${darkMode ? styles.dark : styles.light}`}
          style={{ marginBottom: 0, lineHeight: 1.2 }}
        >
          {title}
        </div>
      </div>
      <div className={`${styles.metricValue} ${darkMode ? styles.dark : styles.light}`}>{value}</div>
    </div>
  );
}