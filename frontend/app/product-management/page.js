"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import { getBackendUrl } from "@/lib/backend_url";
import { useSyncedTheme } from "@/lib/theme";
import { clearAuthStoragePreserveTheme } from "@/lib/auth";

export default function ProductManagement() {
    const router = useRouter();
    const { darkMode, toggleTheme } = useSyncedTheme();
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [user, setUser] = useState(null);

    const theme = darkMode
        ? {
            pageBg: "#0a0a0a",
            pageText: "#f3f4f6",
            mutedText: "#cbd5e1",
            cardBg: "#121212",
            cardBorder: "1px solid rgba(148, 163, 184, 0.28)",
            headerBg: "#1a1a1a",
            inputBg: "#121212",
            inputBorder: "1px solid rgba(148, 163, 184, 0.45)",
            inputText: "#f8fafc",
            rowBorder: "1px solid rgba(148, 163, 184, 0.22)",
            errorText: "#fecaca"
        }
        : {
            pageBg: "#faf8f5",
            pageText: "#0f172a",
            mutedText: "#334155",
            cardBg: "#ffffff",
            cardBorder: "1px solid rgba(15, 23, 42, 0.12)",
            headerBg: "#f1f5f9",
            inputBg: "#ffffff",
            inputBorder: "1px solid rgba(15, 23, 42, 0.2)",
            inputText: "#0f172a",
            rowBorder: "1px solid rgba(15, 23, 42, 0.1)",
            errorText: "#b91c1c"
        };

    useEffect(() => {
        document.body.style.background = theme.pageBg;
        document.body.style.color = theme.pageText;
    }, [theme.pageBg, theme.pageText]);

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        const storedUserRaw = localStorage.getItem("user");
        const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;

        if (!token) {
            router.push("/login");
            return;
        }

        if (!storedUser || storedUser.role !== "admin") {
            router.push("/dashboard");
            return;
        }

        setUser(storedUser);
        fetchProducts();
    }, []);

    const handleSignOut = async () => {
        try {
            const url = await getBackendUrl();
            const token = localStorage.getItem("access_token");

            await fetch(`${url}/api/auth/logout`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
        } catch {
            // Continue clearing client auth even when logout API fails.
        } finally {
            clearAuthStoragePreserveTheme();
            router.replace("/login");
        }
    };

    const fetchProducts = async () => {
        try {
            setLoading(true);
            setError("");
            const url = await getBackendUrl();
            const token = localStorage.getItem("access_token");

            const res = await fetch(`${url}/api/admin-products/`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                throw new Error("Failed to fetch products");
            }

            const result = await res.json();

            if (result.success) {
                setProducts(result.data.products || []);
            } else {
                setProducts([]);
                setError(result.message || "Could not load products");
            }
        } catch {
            setProducts([]);
            setError("Unable to load products right now");
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return products;

        return products.filter((product) => {
            const productName = String(product.name || "").toLowerCase();
            const productId = String(product.id || "").toLowerCase();
            return productName.includes(query) || productId.includes(query);
        });
    }, [products, searchTerm]);

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

            {/* NAVBAR */}
            <Navbar darkMode={darkMode} toggleTheme={toggleTheme} user={user} />

            <div style={{ display: "flex", marginTop: "70px" }}>

                {/* SIDEBAR */}
                <Sidebar darkMode={darkMode} user={user} handleSignOut={handleSignOut} />

                {/* CONTENT */}
                <div
                    style={{
                        marginLeft: "250px",
                        flex: 1,
                        padding: "40px",
                        background: theme.pageBg,
                        color: theme.pageText,
                        minHeight: "calc(100vh - 70px)"
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "12px",
                            flexWrap: "wrap"
                        }}
                    >
                        <h2 style={{ margin: 0, color: theme.pageText }}>Listed Products</h2>

                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by product name or ID"
                            style={{
                                minWidth: "260px",
                                padding: "10px 12px",
                                borderRadius: "8px",
                                border: theme.inputBorder,
                                background: theme.inputBg,
                                color: theme.inputText,
                                outline: "none"
                            }}
                        />
                    </div>

                    <p style={{ marginTop: "10px", color: theme.mutedText }}>
                        Showing {filteredProducts.length} of {products.length} products
                    </p>

                    {error && (
                        <div
                            style={{
                                marginTop: "14px",
                                color: theme.errorText,
                                fontWeight: 500
                            }}
                        >
                            {error}
                        </div>
                    )}

                    <div
                        style={{
                            marginTop: "20px",
                            borderRadius: "12px",
                            overflowX: "auto",
                            background: theme.cardBg,
                            border: theme.cardBorder
                        }}
                    >
                        <table
                            style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                minWidth: "560px"
                            }}
                        >
                            <thead>
                                <tr style={{ background: theme.headerBg }}>
                                    <th style={{ textAlign: "left", padding: "12px 16px", color: theme.pageText }}>#</th>
                                    <th style={{ textAlign: "left", padding: "12px 16px", color: theme.pageText }}>Product ID</th>
                                    <th style={{ textAlign: "left", padding: "12px 16px", color: theme.pageText }}>Product Name</th>
                                </tr>
                            </thead>

                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={3} style={{ padding: "16px", textAlign: "center", color: theme.mutedText }}>
                                            Loading products...
                                        </td>
                                    </tr>
                                ) : filteredProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ padding: "16px", textAlign: "center", color: theme.mutedText }}>
                                            No matching products found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProducts.map((product, index) => (
                                        <tr
                                            key={product.id ?? `${product.name}-${index}`}
                                            style={{
                                                borderTop: theme.rowBorder,
                                                color: theme.pageText
                                            }}
                                        >
                                            <td style={{ padding: "12px 16px" }}>{index + 1}</td>
                                            <td style={{ padding: "12px 16px" }}>{product.id ?? "-"}</td>
                                            <td style={{ padding: "12px 16px" }}>{product.name ?? "-"}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>
        </div>
    );
}