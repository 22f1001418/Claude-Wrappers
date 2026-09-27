"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import UserChatBot from "@/app/components/chatbot/UserChatBot";
import DashboardNavbar from "@/app/components/Navbar";
import DashboardSidebar from "@/app/components/Sidebar";
import styles from "@/styles/inventory.module.css";
// import dashboardStyles from "@/styles/dashboard.module.css";
import { fetchWithAuth, clearAuthStoragePreserveTheme } from "@/lib/auth";
import InventoryModal from "./InventoryModal";
import { useSyncedTheme } from "@/lib/theme";

export default function InventoryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { darkMode, toggleTheme } = useSyncedTheme();
  
  // Products data
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Stats data
  const [stats, setStats] = useState({
    mostSoldToday: { product: "Loading...", units: 0 },
    mostSoldWeek: { product: "Loading...", units: 0 },
    notSold15Days: { count: 0 },
    highestRevenue: { product: "Loading...", revenue: 0 }
  });
  
  // Low stock items
  const [lowStockItems, setLowStockItems] = useState([]);
  
  // Restock recommendations
  const [restockRecommendations, setRestockRecommendations] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

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
      
      // Fetch inventory data
      fetchProducts(userData);
      fetchStats(userData);
      fetchLowStock(userData);
      fetchRestockRecommendations(userData);
    } else {
      router.replace("/login");
    }

    setLoading(false);
  }, [router]);

  // Fetch products from backend
  const fetchProducts = async (userData) => {
    try {
      const res = await fetchWithAuth("http://localhost:5001/api/inventory/products", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        console.error('Failed to fetch products');
        return;
      }

      const data = await res.json();
      if (data.success) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  // Fetch statistics
  const fetchStats = async (userData) => {
    try {
      const res = await fetchWithAuth("http://localhost:5001/api/inventory/stats", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        console.error('Failed to fetch stats');
        return;
      }

      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch low stock items
  const fetchLowStock = async (userData) => {
    try {
      const res = await fetchWithAuth("http://localhost:5001/api/inventory/low-stock", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        console.error('Failed to fetch low stock items');
        return;
      }

      const data = await res.json();
      if (data.success) {
        setLowStockItems(data.low_stock_items);
      }
    } catch (error) {
      console.error('Error fetching low stock:', error);
    }
  };

  // Fetch restock recommendations
  const fetchRestockRecommendations = async (userData) => {
    try {
      const res = await fetchWithAuth("http://localhost:5001/api/inventory/restock-recommendations", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        console.error('Failed to fetch restock recommendations');
        return;
      }

      const data = await res.json();
      if (data.success) {
        setRestockRecommendations(data.recommendations);
      }
    } catch (error) {
      console.error('Error fetching restock recommendations:', error);
    }
  };

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

  const handleAddNewItem = () => {
    alert("Add New Item functionality to be implemented");
    // TODO: Open modal or navigate to add item form
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "In Stock":
        return darkMode ? "#4caf50" : "#2e7d32";
      case "Low Stock":
        return darkMode ? "#ff9800" : "#ed6c02";
      case "Out of Stock":
        return darkMode ? "#f44336" : "#d32f2f";
      case "Pending":
        return darkMode ? "#ff9800" : "#ed6c02";
      case "Shipped":
        return darkMode ? "#2196f3" : "#1565c0";
      default:
        return darkMode ? "#9e9e9e" : "#616161";
    }
  };

  if (loading) return null;
  if (!user) return null;

  // Helper functions
  const getStockStatus = (stock) => {
    if (stock <= 10) return 'low';
    if (stock <= 50) return 'medium';
    return 'high';
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Filter products based on search
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    if (!normalizedSearch) return true;

    return (
      String(product.product_name || "").toLowerCase().includes(normalizedSearch) ||
      String(product.brand || "").toLowerCase().includes(normalizedSearch) ||
      String(product.unit_price ?? "").toLowerCase().includes(normalizedSearch) ||
      String(product.stock ?? "").toLowerCase().includes(normalizedSearch)
    );
  });

  return (
    <div className={styles.container}>
      <DashboardNavbar 
        darkMode={darkMode} 
        toggleTheme={toggleTheme} 
        handleProfileClick={handleProfileClick}
        user={user}
      />

      {/* LEFT SIDEBAR */}
      <DashboardSidebar 
        darkMode={darkMode} 
        user={user} 
        handleSignOut={handleSignOut} 
        handleProfileClick={handleProfileClick} 
      />

      {/* MAIN CONTENT */}
      <div
        style={{
          marginLeft: "250px",
          marginRight: "320px",
          marginTop: "70px",
          padding: "32px",
          minHeight: "100vh",
          background: darkMode ? "#0a0a0a" : "#faf8f5",
          transition: "all 0.3s ease",
          width: "calc(100% - 570px)"
        }}
      >
        {/* Stats Cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <div className={styles.statIconSpace}>
                <Image
                  src="/vectors/most_sold_today.png"
                  alt="Most sold today"
                  width={40}
                  height={40}
                  className={styles.statIconImage}
                />
              </div>
              <div className={styles.statTitle}>Most Sold Today</div>
            </div>
            <div className={styles.statValue}>{stats.mostSoldToday.units}</div>
            <div className={styles.statSubtext}>{stats.mostSoldToday.product}</div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <div className={styles.statIconSpace}>
                <Image
                  src="/vectors/most_sold_this_week.png"
                  alt="Most sold this week"
                  width={40}
                  height={40}
                  className={styles.statIconImage}
                />
              </div>
              <div className={styles.statTitle}>Most Sold This Week</div>
            </div>
            <div className={styles.statValue}>{stats.mostSoldWeek.units}</div>
            <div className={styles.statSubtext}>{stats.mostSoldWeek.product}</div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <div className={styles.statIconSpace}>
                <Image
                  src="/vectors/not_sold(15 days).png"
                  alt="Not sold in 15 days"
                  width={40}
                  height={40}
                  className={styles.statIconImage}
                />
              </div>
              <div className={styles.statTitle}>Not Sold (15 Days)</div>
            </div>
            <div className={styles.statValue}>{stats.notSold15Days.count}</div>
            <div className={styles.statSubtext}>Products requiring attention</div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <div className={styles.statIconSpace}>
                <Image
                  src="/vectors/highest_revenue.png"
                  alt="Highest revenue"
                  width={40}
                  height={40}
                  className={styles.statIconImage}
                />
              </div>
              <div className={styles.statTitle}>Highest Revenue</div>
            </div>
            <div className={styles.statValue}>{formatCurrency(stats.highestRevenue.revenue)}</div>
            <div className={styles.statSubtext}>{stats.highestRevenue.product}</div>
          </div>
        </div>

        {/* Products Table */}
        <div className={styles.tableContainer}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>Product Inventory</h2>
            <div className={styles.tableControls}>
              <button onClick={() => setModalOpen(true)} className={styles.addButton}>
                <span>+</span>
                <span>Update Inventory</span>
              </button>
            </div>
          </div>

          <input
            type="text"
            placeholder="Search by product name, brand, unit price, stock..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.tableSearchInput}
          />

          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Unit Price</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <tr key={product.product_id}>
                    <td className={styles.productId}>#{product.product_id}</td>
                    <td className={styles.productName}>{product.product_name}</td>
                    <td>
                      <span className={styles.categoryBadge}>{product.class_name}</span>
                    </td>
                    <td>{product.brand}</td>
                    <td className={styles.price}>{formatCurrency(product.unit_price)}</td>
                    <td className={`${styles.stock} ${styles[`stock${getStockStatus(product.stock).charAt(0).toUpperCase() + getStockStatus(product.stock).slice(1)}`]}`}>
                      {product.stock} units
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className={styles.emptyState}>
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT SIDEBAR - Low Stock & Restock Recommendations */}
      <div className={styles.lowStockSidebar}>
        {/* Low Stock Alert - 45% height */}
        <div style={{ height: '45%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarIconSpace}>
              <Image
                src="/vectors/low_stock.png"
                alt="Low stock"
                width={28}
                height={28}
                className={styles.sidebarIconImage}
              />
            </div>
            <h3 className={styles.sidebarTitle}>Low Stock Alert</h3>
          </div>

          <div className={styles.lowStockList} style={{ overflowY: 'auto', flex: 1 }}>
            {lowStockItems.length > 0 ? (
              lowStockItems.map((item) => (
                <div key={item.product_id} className={styles.lowStockItem}>
                  <div className={styles.lowStockItemName}>{item.product_name}</div>
                  <div className={styles.lowStockItemDetails}>
                    <div className={styles.lowStockCount}>{item.stock}</div>
                    <div className={styles.lowStockLabel}>units left</div>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                All products are well stocked!
              </div>
            )}
          </div>
        </div>

        {/* Restock Recommendations - 55% height */}
        <div style={{ height: '55%', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderTop: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(44, 110, 126, 0.1)', paddingTop: '20px', marginTop: '20px' }}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarIconSpace}>
              <Image
                src="/vectors/restock_recommendation.png"
                alt="Restock recommendation"
                width={28}
                height={28}
                className={styles.sidebarIconImage}
              />
            </div>
            <h3 className={styles.sidebarTitle}>Restock Recommendations</h3>
          </div>

          <div className={styles.lowStockList} style={{ overflowY: 'auto', flex: 1 }}>
            {restockRecommendations.length > 0 ? (
              restockRecommendations.map((item) => (
                <div 
                  key={item.product_id} 
                  className={styles.restockItem}
                  style={{
                    marginBottom: '12px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: darkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(44, 110, 126, 0.03)',
                    border: `1px solid ${
                      item.priority === 'high' 
                        ? (darkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(220, 38, 38, 0.3)')
                        : item.priority === 'medium'
                        ? (darkMode ? 'rgba(251, 146, 60, 0.3)' : 'rgba(234, 88, 12, 0.3)')
                        : (darkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(37, 99, 235, 0.3)')
                    }`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '13px', 
                        fontWeight: '500', 
                        color: darkMode ? '#ffffff' : '#1a4a52',
                        marginBottom: '4px'
                      }}>
                        {item.product_name}
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: darkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(26, 74, 82, 0.6)',
                        marginBottom: '6px'
                      }}>
                        {item.brand}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '10px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      background: 
                        item.priority === 'high' 
                          ? (darkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(220, 38, 38, 0.1)')
                          : item.priority === 'medium'
                          ? (darkMode ? 'rgba(251, 146, 60, 0.2)' : 'rgba(234, 88, 12, 0.1)')
                          : (darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(37, 99, 235, 0.1)'),
                      color: 
                        item.priority === 'high' 
                          ? (darkMode ? '#ef4444' : '#dc2626')
                          : item.priority === 'medium'
                          ? (darkMode ? '#fb923c' : '#ea580c')
                          : (darkMode ? '#3b82f6' : '#2563eb')
                    }}>
                      {item.priority}
                    </span>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '8px',
                    fontSize: '11px',
                    color: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 74, 82, 0.8)'
                  }}>
                    <div>
                      <span style={{ opacity: 0.6 }}>Current: </span>
                      <span style={{ fontWeight: '600' }}>{item.current_stock}</span>
                    </div>
                    <div>
                      <span style={{ opacity: 0.6 }}>Days left: </span>
                      <span style={{ fontWeight: '600' }}>{item.days_left}</span>
                    </div>
                    <div>
                      <span style={{ opacity: 0.6 }}>Avg/day: </span>
                      <span style={{ fontWeight: '600' }}>{item.avg_daily_sales}</span>
                    </div>
                    <div>
                      <span style={{ opacity: 0.6 }}>Order: </span>
                      <span style={{ fontWeight: '600', color: darkMode ? '#4ade80' : '#16a34a' }}>
                        {item.recommended_qty}
                      </span>
                      {item.unit_price && (
                        <span style={{ 
                          fontSize: '10px', 
                          color: darkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(26, 74, 82, 0.5)',
                          marginLeft: '3px'
                        }}>
                          (₹{(item.recommended_qty * item.unit_price).toLocaleString('en-IN')})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                No restock needed at the moment!
              </div>
            )}
          </div>
        </div>
      </div>

      <InventoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        token={localStorage.getItem("access_token")}
        refreshProducts={fetchProducts}
      />

      {/* CHATBOT */}
      <UserChatBot darkMode={darkMode} username={user?.username || "user"} />
    </div>
  );
}

