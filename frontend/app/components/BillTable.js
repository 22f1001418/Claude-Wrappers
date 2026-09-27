"use client";

import React from "react";
import styles from "@/styles/billTable.module.css";

const BillTable = ({ detectedItems, onCheckout, onRemoveItem, onClearBill }) => {
  const calculateTotal = () => {
    return detectedItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  };

  const handleCheckout = () => {
    if (detectedItems.length === 0) {
      alert("No items in the bill!");
      return;
    }

    onCheckout(detectedItems);
  };
  
  // Wrapper allows optional onClearBill for backward compat
  const handleClear = () => {
      if (onClearBill && confirm("Are you sure you want to clear the entire bill?")) {
          onClearBill();
      }
  };

  return (
    <div className={styles.billContainer}>
      <div className={styles.billHeader}>
        <h2 className={styles.billTitle}>Current Bill</h2>
        {detectedItems.length > 0 && onClearBill && (
            <button 
                onClick={handleClear}
                className={styles.clearButton}
                title="Clear all items"
            >
                🗑️ Clear
            </button>
        )}
      </div>

      <div className={styles.tableWrapper}>
        {detectedItems.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🛒</div>
            <p className={styles.emptyText}>No items detected yet</p>
            <p className={styles.emptySubtext}>
              Place products in camera view
            </p>
          </div>
        ) : (
          <table className={styles.billTable}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {detectedItems.map((item, index) => (
                <tr key={`${item.class_name}-${index}`} className={styles.billRow}>
                  <td className={styles.productCell}>
                    <div className={styles.productName}>{item.product_name}</div>
                    <div className={styles.productBrand}>{item.brand}</div>
                  </td>
                  <td className={styles.qtyCell}>{item.quantity}</td>
                  <td className={styles.priceCell}>₹{item.unit_price}</td>
                  <td className={styles.totalCell}>₹{item.subtotal}</td>
                  <td className={styles.removeCell}>
                    <button
                      className={styles.removeBtn}
                      onClick={() => onRemoveItem && onRemoveItem(item.class_name)}
                      title="Remove item"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.billFooter}>
        <div className={styles.totalSection}>
          <div className={styles.subtotalRow}>
            <span>Subtotal</span>
            <span>₹{calculateTotal()}</span>
          </div>
          <div className={styles.taxRow}>
            <span>Items</span>
            <span>{detectedItems.length}</span>
          </div>
          <div className={styles.grandTotalRow}>
            <span>Total</span>
            <span className={styles.totalAmount}>₹{calculateTotal()}</span>
          </div>
        </div>

        <button
          onClick={handleCheckout}
          disabled={detectedItems.length === 0}
          className={styles.checkoutButton}
        >
          Complete Purchase →
        </button>
      </div>
    </div>
  );
};

export default BillTable;
