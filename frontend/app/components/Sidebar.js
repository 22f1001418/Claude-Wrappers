"use client";

import React, { useCallback } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import OwnerWorkflowTour from "@/app/components/OwnerWorkflowTour";

const DashboardSidebar = ({ darkMode, user, handleSignOut, handleProfileClick }) => {
  const router = useRouter();
  const pathname = usePathname();

  const menuItemStyle = useCallback((path) => ({
    padding: "12px 16px",
    cursor: "pointer",
    color: pathname === path ? (darkMode ? "#d4a549" : "#d4a549") : (darkMode ? "#ffffff" : "#2c6e7e"),
    fontWeight: pathname === path ? "bold" : "500",
    transition: "all 0.2s ease",
    borderRadius: "8px",
    marginBottom: "8px",
    background: pathname === path 
      ? (darkMode ? "rgba(212, 165, 73, 0.15)" : "rgba(44, 110, 126, 0.15)")
      : "transparent",
    fontSize: "15px",
  }), [pathname, darkMode]);

  const renderMenuItem = useCallback(({ path, icon, label, tourId }) => {
    const handleClick = (e) => {
      try {
        e.preventDefault();
        e.stopPropagation();
        router.push(path);
      } catch (error) {
        console.error("Navigation error:", error);
        window.location.href = path;
      }
    };

    return (
      <div
        key={path}
        id={tourId}
        style={menuItemStyle(path)}
        onClick={handleClick}
        onMouseEnter={(e) => {
          if (pathname !== path) {
            e.currentTarget.style.background = darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(44, 110, 126, 0.05)";
          }
        }}
        onMouseLeave={(e) => {
          if (pathname !== path) {
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Image
            src={icon}
            alt={label}
            width={20}
            height={20}
            style={{
              filter: darkMode ? "brightness(0) invert(1)" : "none",
              transition: "filter 0.3s ease"
            }}
          />
          <span>{label}</span>
        </div>
      </div>
    );
  }, [pathname, darkMode, router, menuItemStyle]);

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: "70px",
        bottom: 0,
        width: "250px",
        background: darkMode ? "#121212" : "#ffffff",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: darkMode ? "2px 0 10px rgba(0, 0, 0, 0.5)" : "2px 0 10px rgba(0, 0, 0, 0.1)",
        transition: "all 0.3s ease",
        overflowY: "auto",
        overflowX: "hidden",
        zIndex: 1,
        pointerEvents: "auto",
      }}
    >
      <OwnerWorkflowTour user={user} />

      <div>
        {(user?.role === "owner" || user?.role === "user") && (
          <>
            <h3 style={{
              color: darkMode ? "#ffffff" : "#1a4a52",
              fontSize: "16px",
              fontWeight: "600",
              marginBottom: "20px",
              paddingBottom: "10px",
              borderBottom: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)"
            }}>
              Dashboard Menu
            </h3>

            {renderMenuItem({ path: "/dashboard", icon: "/vectors/dashboard.png", label: "Dashboard", tourId: "owner-tour-nav-dashboard" })}
            {renderMenuItem({ path: "/inventory", icon: "/vectors/inventory.png", label: "Inventory", tourId: "owner-tour-nav-inventory" })}
            {renderMenuItem({ path: "/new-product-category", icon: "/vectors/new_product_category.png", label: "New Product Category", tourId: "owner-tour-nav-new-category" })}
            {renderMenuItem({ path: "/credit", icon: "/vectors/credit.png", label: "Credit Management", tourId: "owner-tour-nav-credit" })}
            {renderMenuItem({ path: "/detection", icon: "/vectors/billing_counter.svg", label: "Billing Counter", tourId: "owner-tour-nav-detection" })}
            {renderMenuItem({ path: "/workspace", icon: "/vectors/Workspace.png", label: "Workspace", tourId: "owner-tour-nav-workspace" })}
            {renderMenuItem({ path: "/notes", icon: "/vectors/bill.png", label: "Notes", tourId: "owner-tour-nav-notes" })}
          </>
        )}

        {user?.role === "cashier" && (
          <>
            <h3 style={{
              color: darkMode ? "#ffffff" : "#1a4a52",
              fontSize: "16px",
              fontWeight: "600",
              marginBottom: "20px",
              paddingBottom: "10px",
              borderBottom: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)"
            }}>
              Cashier Panel
            </h3>

            {renderMenuItem({ path: "/inventory", icon: "/vectors/inventory.png", label: "Inventory" })}
            {renderMenuItem({ path: "/credit", icon: "/vectors/credit.png", label: "Credit Management" })}
            {renderMenuItem({ path: "/detection", icon: "/vectors/billing_counter.svg", label: "Billing Counter" })}
          </>
        )}

        {user?.role === "admin" && (
          <>
            <h3 style={{
              color: darkMode ? "#ffffff" : "#1a4a52",
              fontSize: "16px",
              fontWeight: "600",
              marginBottom: "20px",
              paddingBottom: "10px",
              borderBottom: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)"
            }}>
              Admin Panel
            </h3>

            {renderMenuItem({ path: "/dashboard", icon: "/vectors/dashboard.png", label: "Dashboard" })}
            {renderMenuItem({ path: "/product-management", icon: "/vectors/inventory.png", label: "Product Management" })}
            {renderMenuItem({ path: "/annotation", icon: "/vectors/bill.png", label: "Annotation Tool" })}
          </>
        )}
      </div>

      {/* BOTTOM SECTION - Profile & Sign Out */}
      <div style={{
        paddingTop: "20px",
        borderTop: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        width: "100%"
      }}>
        <div
          id="owner-tour-profile-link"
          onClick={(e) => {
            try {
              e.preventDefault();
              e.stopPropagation();
              router.push("/profile");
            } catch (error) {
              console.error("Profile click error:", error);
            }
          }}
          style={{
            cursor: "pointer",
            color: darkMode ? "#ffffff" : "#1a4a52",
            fontSize: "14px",
            fontWeight: "500",
            transition: "all 0.2s ease",
            padding: "8px 0",
            flex: 1
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = darkMode ? "#d4a549" : "#d4a549";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = darkMode ? "#ffffff" : "#1a4a52";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Image
              src="/vectors/profile.png"
              alt="Profile"
              width={20}
              height={20}
              style={{
                filter: darkMode ? "brightness(0) invert(1)" : "none",
                transition: "filter 0.3s ease"
              }}
            />
            <span>Profile</span>
          </div>
        </div>
        
        <div
          onClick={(e) => {
            try {
              e.preventDefault();
              e.stopPropagation();
              handleSignOut();
            } catch (error) {
              console.error("Sign out error:", error);
            }
          }}
          style={{
            cursor: "pointer",
            transition: "all 0.2s ease",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
          title="Sign Out"
        >
          <Image
            src="/vectors/logout.png"
            alt="Sign Out"
            width={24}
            height={24}
            style={{
              filter: "brightness(0) saturate(100%) invert(47%) sepia(89%) saturate(2370%) hue-rotate(334deg) brightness(92%) contrast(94%)",
              transition: "filter 0.3s ease"
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(DashboardSidebar);
