"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import DashboardNavbar from "@/app/components/Navbar";
import DashboardSidebar from "@/app/components/Sidebar";
import UserChatBot from "@/app/components/chatbot/UserChatBot";
import { fetchWithAuth } from "@/lib/auth";
import styles from "@/styles/dashboard.module.css";
import { useSyncedTheme } from "@/lib/theme";

export default function BillingPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const { darkMode, toggleTheme } = useSyncedTheme();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [items, setItems] = useState([
    { product_name: "", units: 1, unit_price: 0, product_id: null }
  ]);

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [previousSale, setPreviousSale] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  const [productSuggestions, setProductSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);

  const [extraDueAdded, setExtraDueAdded] = useState(0);

  const [linkedPreviousSaleId, setLinkedPreviousSaleId] = useState(null);
  const [billCreated, setBillCreated] = useState(false);
  const [createdBillData, setCreatedBillData] = useState(null);
  const [billError, setBillError] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // ---- UPI payment states ----
  const [upiPaymentStatus, setUpiPaymentStatus] = useState(null); // null | "success" | "failed" | "cancelled"
  const [upiPaymentId, setUpiPaymentId] = useState(null);

  // ---- Credit payment choice modal ----
  const [showCreditChoiceModal, setShowCreditChoiceModal] = useState(false);
  const [pendingValidItems, setPendingValidItems] = useState(null);

  const getValidItems = () =>
    items.filter(
      (item) =>
        String(item.product_name || "").trim().length > 0 &&
        Number(item.units) > 0
    );

  const resetBillingForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setItems([{ product_name: "", units: 1, unit_price: 0, product_id: null }]);
    setPaymentMethod("cash");
    setAmountPaid("");
    setDueDate("");
    setPreviousSale(null);
    setShowPopup(false);
    setProductSuggestions([]);
    setActiveIndex(null);
    setExtraDueAdded(0);
    setLinkedPreviousSaleId(null);
    setBillCreated(false);
    setCreatedBillData(null);
    setBillError("");
    setIsProcessingPayment(false);
    setUpiPaymentStatus(null);
    setUpiPaymentId(null);
    setShowCreditChoiceModal(false);
    setPendingValidItems(null);
  };

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  // ================= AUTH =================
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));

  }, [router]);

  useEffect(() => {
    const loadBill = () => {
      const storedBill = localStorage.getItem("detected_bill");

      if (storedBill) {
        try {
          const parsedItems = JSON.parse(storedBill);
          setItems(parsedItems);
          localStorage.removeItem("detected_bill");
        } catch (err) {
          console.error("Error parsing detected bill:", err);
        }
      }
    };

    loadBill();
    window.addEventListener("focus", loadBill);
    return () => window.removeEventListener("focus", loadBill);
  }, []);

  // ================= CHECK CUSTOMER =================
  const checkExistingCustomer = async (name) => {
    if (!name) return;

    try {
      const res = await fetchWithAuth(
        `http://localhost:5001/api/billing/check-customer?name=${encodeURIComponent(name)}`
      );

      const data = await res.json();
      console.log("Customer Check Response:", data);

      if (data.success && (data.sale || data.data)) {
        const saleData = data.sale || data.data;

        if (saleData.amount_remaining > 0) {
          setPreviousSale(saleData);
          setShowPopup(true);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ================= HANDLE ITEM CHANGE =================
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  // ================= PRODUCT SEARCH =================
  const handleProductSearch = async (index, value) => {
    handleItemChange(index, "product_name", value);

    if (!value) {
      setProductSuggestions([]);
      return;
    }

    try {
      const res = await fetchWithAuth(
        `http://localhost:5001/api/billing/products?q=${encodeURIComponent(value)}`
      );
      const data = await res.json();

      if (data.success && data.data) {
        setProductSuggestions(data.data);
        setActiveIndex(index);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectProduct = (index, product) => {
    const updated = [...items];

    updated[index] = {
      ...updated[index],
      product_name: product.product_name,
      unit_price: product.unit_price,
      product_id: product.product_id
    };

    setItems(updated);
    setProductSuggestions([]);
    setActiveIndex(null);
  };

  const addItem = () => {
    setItems([
      ...items,
      { product_name: "", units: 1, unit_price: 0, product_id: null }
    ]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // ================= TOTAL =================
  const totalCost =
    items.reduce((sum, item) => sum + item.units * item.unit_price, 0) +
    extraDueAdded;

  const remainingAmount =
    paymentMethod === "credit"
      ? Math.max(totalCost - (Number(amountPaid) || 0), 0)
      : 0;

  const effectiveAmountPaid =
    paymentMethod === "credit" ? Number(amountPaid) || 0 : totalCost;

  // ================= CREATE BILL REQUEST =================
  const createBillRequest = async (validItems, amountPaidValue, razorpayPaymentId = null) => {
    const res = await fetchWithAuth(
      "http://localhost:5001/api/billing/create",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName,
          customer_phone: customerPhone,
          items: validItems,
          total_cost: totalCost,
          amount_paid: amountPaidValue,
          payment_method: paymentMethod,
          due_date: dueDate,
          previous_sale_id: linkedPreviousSaleId,
          ...(razorpayPaymentId && { razorpay_payment_id: razorpayPaymentId })
        })
      }
    );

    const data = await res.json();

    if (data.success) {
      setBillCreated(true);
      setCreatedBillData(data.data);
      return;
    }

    throw new Error(data.message || "Bill cannot be created.");
  };

  // ================= UPI RAZORPAY FLOW =================
  const handleUpiRazorpayFlow = async (validItems) => {
    if (totalCost <= 0) {
      setBillError("Total amount must be greater than 0.");
      return;
    }

    setIsProcessingPayment(true);
    setBillError("");

    try {
      const isScriptLoaded = await loadRazorpayScript();
      if (!isScriptLoaded) {
        throw new Error("Unable to load Razorpay checkout. Please check your internet connection.");
      }

      const orderRes = await fetchWithAuth(
        "http://localhost:5001/api/billing/razorpay/create-order",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: totalCost })
        }
      );

      const orderData = await orderRes.json();
      if (!orderData.success) {
        throw new Error(orderData.message || "Unable to initiate UPI payment.");
      }

      const { key_id, order_id } = orderData.data;

      const options = {
        key: key_id,
        order_id,
        amount: totalCost * 100,
        currency: "INR",
        name: "Vyapar AI",
        description: `Bill Payment — ₹${totalCost}`,
        prefill: {
          name: customerName || "",
          contact: customerPhone || ""
        },
        // NOTE: Do NOT pass a `method` filter or `config.display` block here.
        // Razorpay decides available methods from your account/dashboard settings.
        // Restricting methods on the frontend causes "No payment method found"
        // if that method isn't enabled at the account level.
        theme: {
          color: "#2c6e7e"
        },
        handler: async function (response) {
          try {
            const verifyRes = await fetchWithAuth(
              "http://localhost:5001/api/billing/razorpay/verify",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                })
              }
            );

            const verifyData = await verifyRes.json();
            if (!verifyData.success) {
              throw new Error(verifyData.message || "Payment verification failed.");
            }

            await createBillRequest(validItems, totalCost, response.razorpay_payment_id);

            setUpiPaymentStatus("success");
            setUpiPaymentId(response.razorpay_payment_id);
            setBillError("");
          } catch (error) {
            setUpiPaymentStatus("failed");
            setBillError(error.message || "Payment verification failed. Please contact support.");
          } finally {
            setIsProcessingPayment(false);
          }
        },
        modal: {
          backdropclose: false,
          escape: true,
          ondismiss: () => {
            setIsProcessingPayment(false);
            setUpiPaymentStatus("cancelled");
            // No billError set here — the yellow box handles the messaging
          }
        }
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on("payment.failed", function (response) {
        setUpiPaymentStatus("failed");
        setBillError(
          `Payment failed: ${response.error?.description || "Unknown error"}. ` +
          `Error code: ${response.error?.code || "N/A"}`
        );
        setIsProcessingPayment(false);
      });

      razorpay.open();
    } catch (error) {
      setBillError(error.message || "Unable to start UPI payment.");
      setIsProcessingPayment(false);
    }
  };

  // ================= SUBMIT =================
  const handleSubmit = async () => {
    const validItems = getValidItems();

    if (validItems.length === 0) {
      setBillError("Bill is empty. Add at least one item before creating bill.");
      return;
    }

    if (paymentMethod === "credit") {
      if (!customerName.trim()) {
        setBillError("Customer name is required for credit billing.");
        return;
      }
      if (!dueDate) {
        setBillError("Due Date is required for credit billing.");
        return;
      }
      setShowCreditChoiceModal(true);
      setPendingValidItems(validItems);
      return;
    }

    setBillError("");
    setUpiPaymentStatus(null);

    try {
      if (paymentMethod === "upi") {
        await handleUpiRazorpayFlow(validItems);
      } else {
        await createBillRequest(validItems, effectiveAmountPaid);
        alert("Bill Created Successfully ✅");
      }
    } catch (err) {
      setBillError(err.message || "Bill cannot be created right now. Please try again.");
    }
  };

  // ================= HANDLE CREDIT CHOICE =================
  const handleCreditChoice = async (chosen) => {
    setShowCreditChoiceModal(false);

    if (!pendingValidItems) return;

    try {
      if (chosen === "upi") {
        await handleUpiRazorpayFlow(pendingValidItems);
      } else {
        await createBillRequest(pendingValidItems, effectiveAmountPaid);
        alert("Bill Created Successfully ✅");
      }
    } catch (err) {
      setBillError(err.message || "Bill cannot be created right now. Please try again.");
    } finally {
      setPendingValidItems(null);
    }
  };

  // ================= GENERATE INVOICE =================
  const generateInvoice = () => {
    if (!createdBillData) return;

    const invoiceWindow = window.open("", "Invoice");

    invoiceWindow.document.write(`
    <html>
      <head>
        <title>Invoice</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          h2 { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f4f4f4; }
          .total { text-align: right; margin-top: 20px; font-size: 18px; }
          .due { color: #e74c3c; font-weight: bold; }
          .upi-badge {
            display: inline-block;
            background: #2c6e7e;
            color: white;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 13px;
            margin-left: 8px;
          }
        </style>
      </head>
      <body>
        <h2>Invoice</h2>

        <p><strong>Customer:</strong> ${customerName || "N/A"}</p>
        <p><strong>Phone:</strong> ${customerPhone || "N/A"}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p>
          <strong>Payment Method:</strong> ${paymentMethod.toUpperCase()}
          ${upiPaymentId ? `<span class="upi-badge">UPI ID: ${upiPaymentId}</span>` : ""}
        </p>

        <table>
          <tr>
            <th>Product</th>
            <th>Units</th>
            <th>Price</th>
            <th>Total</th>
          </tr>

          ${items.map(item => `
            <tr>
              <td>${item.product_name}</td>
              <td>${item.units}</td>
              <td>₹ ${item.unit_price}</td>
              <td>₹ ${item.units * item.unit_price}</td>
            </tr>
          `).join("")}

        </table>

        ${extraDueAdded > 0 ? `
          <p class="due">
            Previous Due Payment Cleared: ₹ ${extraDueAdded}
          </p>
        ` : ""}

        <div class="total">
          <p><strong>Grand Total:</strong> ₹ ${totalCost}</p>
          <p><strong>Paid:</strong> ₹ ${effectiveAmountPaid}</p>
          <p><strong>Remaining:</strong> ₹ ${remainingAmount}</p>
        </div>

        <script>
          window.print();
        </script>

      </body>
    </html>
  `);

    invoiceWindow.document.close();
    resetBillingForm();
  };

  // ================= RENDER PAYMENT BUTTON AREA =================
  const renderPaymentActions = () => {
    // Bill already created → show invoice / new bill options
    if (billCreated) {
      return (
        <div style={{ marginTop: "20px" }}>
          {paymentMethod === "upi" && upiPaymentStatus === "success" && (
            <div style={upiSuccessBanner}>
              ✅ UPI Payment Successful!
              {upiPaymentId && (
                <span style={{ fontSize: "12px", marginLeft: "10px", opacity: 0.8 }}>
                  Payment ID: {upiPaymentId}
                </span>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button onClick={generateInvoice} style={{ ...addBtnStyle, background: "#27ae60" }}>
              🧾 Generate Invoice
            </button>
            <button onClick={resetBillingForm} style={{ ...addBtnStyle, background: "var(--table-header-bg)", color: "var(--text-primary)" }}>
              New Bill Without Invoice
            </button>
          </div>
        </div>
      );
    }

    // UPI cancelled — yellow warning box, then retry button OUTSIDE/BELOW the box
    if (paymentMethod === "upi" && upiPaymentStatus === "cancelled") {
      return (
        <div style={{ marginTop: "20px" }}>
          <div style={upiCancelledBanner}>
            ⚠️ Payment was cancelled or closed. Please retry to complete the payment.
          </div>
          <button
            onClick={() => {
              setUpiPaymentStatus(null);
              setBillError("");
              handleSubmit();
            }}
            disabled={isProcessingPayment}
            style={{
              ...addBtnStyle,
              marginTop: "10px",
              background: "var(--accent-gradient)",
              cursor: isProcessingPayment ? "not-allowed" : "pointer"
            }}
          >
            🔄 Retry UPI Payment
          </button>
        </div>
      );
    }

    // Credit with UPI choice was cancelled — show same yellow banner
    if (paymentMethod === "credit" && upiPaymentStatus === "cancelled") {
      return (
        <div style={{ marginTop: "20px" }}>
          <div style={upiCancelledBanner}>
            ⚠️ Payment was cancelled or closed. Please retry to complete the payment.
          </div>
          <button
            onClick={() => {
              setUpiPaymentStatus(null);
              setBillError("");
              setShowCreditChoiceModal(true);
              setPendingValidItems(getValidItems());
            }}
            disabled={isProcessingPayment}
            style={{
              ...addBtnStyle,
              marginTop: "10px",
              background: "var(--accent-gradient)",
              cursor: isProcessingPayment ? "not-allowed" : "pointer"
            }}
          >
            🔄 Retry Payment
          </button>
        </div>
      );
    }

    // Default: Create Bill / Pay via UPI button
    return (
      <button
        onClick={handleSubmit}
        disabled={isProcessingPayment}
        style={{
          ...addBtnStyle,
          marginTop: "20px",
          background: isProcessingPayment ? "var(--table-header-bg)" : "var(--accent-gradient)",
          cursor: isProcessingPayment ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}
      >
        {isProcessingPayment
          ? "Processing Payment..."
          : paymentMethod === "upi"
            ? "Pay via UPI / QR Code"
            : "Create Bill"}
      </button>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <DashboardNavbar darkMode={darkMode} toggleTheme={toggleTheme} user={user} />

      <div style={{ display: "flex", marginTop: "70px", color: "var(--text-primary)" }}>
        <DashboardSidebar darkMode={darkMode} user={user} />

        <div style={{ marginLeft: "250px", flex: 1, padding: "40px", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "30px"
          }}>
            <h2 className={`${styles.dashboardTitle} ${darkMode ? styles.dark : styles.light}`} style={{ margin: 0 }}>
              Manual Billing
            </h2>

            <div style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              background: "var(--card-bg)",
              border: "1px solid var(--border-color)",
              padding: "6px",
              borderRadius: "14px"
            }}>
              <button
                onClick={() => router.push("/detection")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 18px",
                  borderRadius: "10px",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  fontSize: "14px",
                  fontWeight: "600",
                  lineHeight: 1,
                  cursor: "pointer"
                }}
              >
                <Image
                  src="/vectors/smart_cart_detection.png"
                  alt="Smart Cart Detection"
                  width={25}
                  height={25}
                  style={{ objectFit: "contain", filter: "brightness(0) saturate(100%)" }}
                />
                <span>Smart Cart Detection</span>
              </button>

              <button
                onClick={() => router.push("/billing")}
                className="mode-toggle-active"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 18px",
                  borderRadius: "10px",
                  background: darkMode ? "rgba(212, 165, 73, 0.18)" : "var(--accent-gradient)",
                  color: "#fff",
                  border: darkMode ? "1px solid rgba(212, 165, 73, 0.55)" : "1px solid transparent",
                  boxShadow: darkMode ? "0 0 0 1px rgba(212, 165, 73, 0.18)" : "none",
                  fontSize: "14px",
                  fontWeight: "600",
                  lineHeight: 1,
                  cursor: "pointer"
                }}
              >
                <Image
                  src="/vectors/new_manual_billing.png"
                  alt="Manual Billing"
                  width={25}
                  height={25}
                  style={{ objectFit: "contain", filter: "brightness(0) invert(1)" }}
                />
                <span>Manual Billing</span>
              </button>
            </div>
          </div>

          <div className={styles.tableCard} style={cardStyle}>
            <h3 style={{ ...cardTitle, display: "flex", alignItems: "center", gap: "8px" }}>
              <Image
                src="/vectors/customer_details.png"
                alt="Customer Details"
                width={20}
                height={20}
                style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }}
              />
              <span>Customer Details</span>
            </h3>
            <div style={gridStyle}>
              <input
                type="text"
                placeholder="Customer Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onBlur={(e) => checkExistingCustomer(e.target.value)}
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="Customer Phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ ...cardTitle, display: "flex", alignItems: "center", gap: "8px" }}>
              <Image
                src="/vectors/new_manual_billing.png"
                alt="Bill Items"
                width={20}
                height={20}
                style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }}
              />
              <span>Bill Items</span>
            </h3>

            <div style={{ ...itemRowStyle, fontWeight: 600, marginBottom: "6px", color: "var(--text-secondary)" }}>
              <div>Product Name</div>
              <div>Units</div>
              <div>Total Price</div>
              <div></div>
            </div>

            {items.map((item, index) => (
              <div key={index} style={itemRowStyle}>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={item.product_name}
                    onChange={(e) => handleProductSearch(index, e.target.value)}
                    placeholder="Enter product name..."
                    style={inputStyle}
                  />

                  {activeIndex === index && productSuggestions.length > 0 && (
                    <div style={dropdownStyle}>
                      {productSuggestions.map((p) => (
                        <div
                          key={p.product_id}
                          onClick={() => selectProduct(index, p)}
                          style={dropdownItemStyle}
                        >
                          {p.product_name} — ₹ {p.unit_price}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  type="number"
                  value={item.units}
                  onChange={(e) =>
                    handleItemChange(index, "units", parseInt(e.target.value) || 1)
                  }
                  style={inputStyle}
                />

                <div style={{ fontWeight: "600" }}>₹ {item.units * item.unit_price}</div>

                <button onClick={() => removeItem(index)} style={removeBtnStyle}>
                  ✕
                </button>
              </div>
            ))}
            <button onClick={addItem} style={addBtnStyle}>
              + Add Product
            </button>

            {extraDueAdded > 0 && (
              <p style={{ marginTop: "10px", color: "#e74c3c" }}>
                Previous Due Added: ₹ {extraDueAdded}
              </p>
            )}

            <h3 style={{ marginTop: "15px", color: "var(--text-primary)" }}>
              Grand Total: ₹ {totalCost}
            </h3>
          </div>

          <div style={cardStyle}>
            <h3 style={{ ...cardTitle, display: "flex", alignItems: "center", gap: "8px" }}>
              <Image
                src="/vectors/payment_method.png"
                alt="Payment"
                width={20}
                height={20}
                style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.95)" : "none" }}
              />
              <span>Payment</span>
            </h3>

            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                                       if (e.target.value === "credit") {
                                         setAmountPaid("0");
                                       } else {
                                         setAmountPaid("");
                                       }
                    setUpiPaymentStatus(null);
                    setBillError("");
                  }}
                  style={inputStyle}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="credit">Credit</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Amount Paid</label>
                <input
                  type="number"
                  value={paymentMethod === "credit" ? amountPaid : totalCost}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  disabled={paymentMethod !== "credit"}
                  readOnly={paymentMethod !== "credit"}
                  style={{
                    ...inputStyle,
                    background: paymentMethod === "credit" ? "var(--input-bg)" : "var(--table-header-bg)"
                  }}
                />
              </div>

              {paymentMethod === "credit" && (
                <>
                  <div>
                    <label style={labelStyle}>Amount Remaining</label>
                    <input
                      type="number"
                      value={remainingAmount}
                      readOnly
                      style={{ ...inputStyle, background: "var(--table-header-bg)" }}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Due Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </>
              )}

              {paymentMethod === "upi" && !billCreated && (
                <div style={{
                  gridColumn: "1 / -1",
                  background: "var(--row-hover-bg)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  color: "var(--text-secondary)"
                }}>
                  Clicking <strong>"Pay via UPI / QR Code"</strong> will open the Razorpay payment
                  window where the customer can scan a QR code or pay via their UPI ID.
                  The bill will be created automatically after successful payment.
                </div>
              )}
            </div>

            {/* Dynamic button/action area */}
            {renderPaymentActions()}

            {/* Only show billError for non-cancelled states (empty bill, failed payment, etc.) */}
            {billError && upiPaymentStatus !== "cancelled" && (
              <p style={{ marginTop: "10px", color: "#e74c3c", fontSize: "13px" }}>
                ⚠️ {billError}
              </p>
            )}
          </div>

          {showPopup && previousSale && (
            <div style={popupOverlay}>
              <div style={popupBox}>
                <h3 style={cardTitle}>⚠️ Previous Pending Sale</h3>

                <p><strong>Name:</strong> {previousSale.customer_name}</p>
                <p><strong>Phone:</strong> {previousSale.customer_phone}</p>
                <p><strong>Date:</strong> {previousSale.date_of_purchase}</p>
                <p><strong>Payment:</strong> {previousSale.payment_method}</p>

                <hr />

                <h4>Items:</h4>
                {previousSale.items?.map((item, i) => (
                  <div key={i}>
                    {item.product_name} ({item.units} × ₹{item.unit_price})
                  </div>
                ))}

                <hr />

                <p><strong>Total:</strong> ₹ {previousSale.total_cost}</p>
                <p><strong>Paid:</strong> ₹ {previousSale.amount_paid}</p>
                <p><strong>Remaining:</strong> ₹ {previousSale.amount_remaining}</p>

                <div style={{ display: "flex", gap: "12px", marginTop: "15px" }}>
                  <button
                    onClick={() => {
                      setExtraDueAdded(previousSale.amount_remaining);
                      setLinkedPreviousSaleId(previousSale.sale_id);
                      setShowPopup(false);
                    }}
                    style={addBtnStyle}
                  >
                    Add Remaining to This Bill
                  </button>

                  <button
                    onClick={() => setShowPopup(false)}
                    style={removeBtnStyle}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---- CREDIT CHOICE MODAL ---- */}
          {showCreditChoiceModal && (
            <div style={popupOverlay}>
              <div style={popupBox}>
                <h3 style={cardTitle}>How do you want to handle this credit payment?</h3>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                  Choose between paying via Cash or UPI. If UPI, the customer will need to complete the payment before the bill is created.
                </p>

                <div style={{ display: "flex", gap: "12px", marginTop: "15px" }}>
                  <button
                    onClick={() => handleCreditChoice("cash")}
                    style={{
                      ...addBtnStyle,
                      flex: 1,
                      background: "var(--table-header-bg)",
                      color: "var(--text-primary)",
                      padding: "12px"
                    }}
                  >
                    Cash
                  </button>

                  <button
                    onClick={() => handleCreditChoice("upi")}
                    style={{
                      ...addBtnStyle,
                      flex: 1,
                      background: "var(--accent-gradient)",
                      padding: "12px"
                    }}
                  >
                    UPI Payment
                  </button>

                  <button
                    onClick={() => {
                      setShowCreditChoiceModal(false);
                      setPendingValidItems(null);
                    }}
                    style={{
                      ...removeBtnStyle,
                      padding: "12px"
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <UserChatBot darkMode={darkMode} user={user} />
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const cardTitle = { marginBottom: "18px", color: "var(--text-primary)" };

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px"
};

const cardStyle = {
  padding: "18px",
  marginBottom: "30px",
  borderRadius: "12px",
  background: "var(--card-bg)",
  color: "var(--text-primary)",
  boxShadow: "var(--card-shadow)",
  border: "1px solid var(--border-color)"
};

const inputStyle = {
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid var(--border-color)",
  fontSize: "14px",
  background: "var(--input-bg)",
  color: "var(--text-primary)"
};

const itemRowStyle = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr auto",
  gap: "12px",
  marginBottom: "10px",
  alignItems: "center"
};

const dropdownStyle = {
  position: "absolute",
  background: "var(--card-bg)",
  border: "1px solid var(--border-color)",
  width: "100%",
  borderRadius: "8px",
  zIndex: 1000,
  boxShadow: "var(--card-shadow)"
};

const dropdownItemStyle = {
  padding: "8px",
  cursor: "pointer",
  color: "var(--text-primary)"
};

const addBtnStyle = {
  padding: "7px 14px",
  background: "var(--accent-gradient)",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

const removeBtnStyle = {
  padding: "7px 14px",
  background: "#e74c3c",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer"
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontWeight: "600",
  fontSize: "14px",
  color: "var(--text-secondary)"
};

const popupOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 2000
};

const popupBox = {
  background: "var(--card-bg)",
  color: "var(--text-primary)",
  padding: "22px",
  borderRadius: "12px",
  width: "420px",
  border: "1px solid var(--border-color)",
  boxShadow: "var(--card-shadow)"
};

const upiSuccessBanner = {
  background: "rgba(46, 204, 113, 0.15)",
  border: "1px solid rgba(46, 204, 113, 0.35)",
  color: "var(--text-primary)",
  padding: "10px 14px",
  borderRadius: "8px",
  fontWeight: "600",
  fontSize: "14px"
};

const upiCancelledBanner = {
  background: "rgba(255, 193, 7, 0.15)",
  border: "1px solid rgba(255, 193, 7, 0.35)",
  color: "var(--text-primary)",
  padding: "10px 14px",
  borderRadius: "8px",
  fontWeight: "600",
  fontSize: "14px"
};