"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import styler from "@/styles/cashiers.module.css";
import { getBackendUrl } from "@/lib/backend_url";
import { useSyncedTheme } from "@/lib/theme";

export default function ManageAdmins() {
    const router = useRouter();

    const [admins, setAdmins] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);

    const { darkMode, toggleTheme } = useSyncedTheme();

    const [formData, setFormData] = useState({
        full_name: "",
        username: "",
        email: "",
        password: "",
        confirmPassword: ""
    });

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [adminToDelete, setAdminToDelete] = useState(null);

    const theme = darkMode
        ? {
            pageBg: "#0a0a0a",
            pageText: "#f3f4f6",
            mutedText: "#cbd5e1",
            cardBg: "#121212",
            border: "1px solid rgba(148, 163, 184, 0.28)",
            inputBg: "#1a1a1a",
            inputBorder: "1px solid rgba(148, 163, 184, 0.45)",
            inputText: "#f8fafc",
            modalOverlay: "rgba(0, 0, 0, 0.76)",
            cancelBorder: "1px solid rgba(148, 163, 184, 0.45)"
        }
        : {
            pageBg: "#faf8f5",
            pageText: "#0f172a",
            mutedText: "#334155",
            cardBg: "#ffffff",
            border: "1px solid rgba(15, 23, 42, 0.12)",
            inputBg: "#ffffff",
            inputBorder: "1px solid rgba(15, 23, 42, 0.2)",
            inputText: "#0f172a",
            modalOverlay: "rgba(15, 23, 42, 0.55)",
            cancelBorder: "1px solid #d1d5db"
        };

    useEffect(() => {
        document.body.style.background = theme.pageBg;
        document.body.style.color = theme.pageText;
    }, [theme.pageBg, theme.pageText]);

    // ✅ Auth check
    useEffect(() => {
        const token = localStorage.getItem("access_token");

        const userData = localStorage.getItem("user");
        const storedUser = userData ? JSON.parse(userData) : null;

        if (!token || storedUser?.role !== "admin") {
            router.push("/dashboard");
            return;
        }

        setUser(storedUser);
        fetchAdmins();
    }, []);

    // ✅ Fetch admins
    const fetchAdmins = async () => {
        try {
            const url = await getBackendUrl();
            const token = localStorage.getItem("access_token");

            const res = await fetch(`${url}/api/auth/admins`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await res.json();
            setAdmins(data.admins || []);
        } catch {
            setError("Failed to fetch admins");
        } finally {
            setLoading(false);
        }
    };

    // ✅ Form handlers
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        try {
            const url = await getBackendUrl();
            const token = localStorage.getItem("access_token");

            const res = await fetch(`${url}/api/auth/admins`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            setSuccess(data.message);
            fetchAdmins();

            setFormData({
                full_name: "",
                username: "",
                email: "",
                password: "",
                confirmPassword: ""
            });

            setTimeout(() => {
                setShowForm(false);
                setSuccess("");
            }, 1500);

        } catch (err) {
            setError(err.message);
        }
    };

    // ✅ Delete admin
    const handleDelete = async (username) => {
        try {
            const url = await getBackendUrl();
            const token = localStorage.getItem("access_token");

            await fetch(`${url}/api/auth/admins/${username}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            setAdminToDelete(null);
            fetchAdmins();
        } catch {
            setError("Delete failed");
        }
    };

    const openDeleteModal = (username) => {
        setAdminToDelete(username);
    };

    const closeDeleteModal = () => {
        setAdminToDelete(null);
    };

    // ✅ Input style (FIXED UI)
    const inputStyle = {
        padding: "10px 12px",
        borderRadius: "6px",
        border: theme.inputBorder,
        background: theme.inputBg,
        color: theme.inputText,
        outline: "none",
        fontSize: "14px",
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

            {/* NAVBAR */}
            <Navbar darkMode={darkMode} toggleTheme={toggleTheme} user={user} />

            {/* MAIN LAYOUT */}
            <div style={{ display: "flex", marginTop: "70px" }}>

                {/* SIDEBAR */}
                <Sidebar darkMode={darkMode} user={user} />

                {/* MAIN CONTENT */}
                <main className={styler.main} style={{ background: theme.pageBg, color: theme.pageText }}>

                    {/* HEADER */}
                    <div className={styler.header}>
                        <div>
                            <h1 style={{ color: theme.pageText }}>All Admins</h1>
                            <p style={{ color: theme.mutedText }}>Manage admin accounts</p>
                        </div>

                        <button
                            className={styler.addButton}
                            onClick={() => setShowForm(!showForm)}
                        >
                            {showForm ? "Cancel" : "+ Add Admin"}
                        </button>
                    </div>

                    {/* FORM */}
                    {showForm && (
                        <div
                            className={styler.formCard}
                            style={{
                                background: theme.cardBg,
                                border: theme.border,
                                color: theme.pageText
                            }}
                        >
                            <h2>Add New Admin</h2>

                            {error && <div className={styler.errorMessage}>{error}</div>}
                            {success && <div className={styler.successMessage}>{success}</div>}

                            <form
                                onSubmit={handleSubmit}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: "16px",
                                    marginTop: "20px"
                                }}
                            >
                                <input name="full_name" placeholder="Full Name" style={inputStyle} onChange={handleChange} required />
                                <input name="username" placeholder="Username" style={inputStyle} onChange={handleChange} required />

                                <input name="email" placeholder="Email" style={inputStyle} onChange={handleChange} required />
                                <input type="password" name="password" placeholder="Password" style={inputStyle} onChange={handleChange} required />

                                <input
                                    type="password"
                                    name="confirmPassword"
                                    placeholder="Confirm Password"
                                    style={{ ...inputStyle, gridColumn: "span 2" }}
                                    onChange={handleChange}
                                    required
                                />

                                <button
                                    type="submit"
                                    className={styler.submitButton}
                                    style={{
                                        gridColumn: "span 2",
                                        background: darkMode
                                            ? "linear-gradient(90deg,#2c6e7e,#d4a549)"
                                            : undefined,
                                        color: darkMode ? "#fff" : undefined
                                    }}
                                >
                                    Create Admin
                                </button>
                            </form>
                        </div>
                    )}

                    {/* LIST */}
                    <div className={styler.cashiersSection}>
                        <h2 style={{ color: theme.pageText }}>All Admins ({admins.length})</h2>

                        {loading ? (
                            <p>Loading...</p>
                        ) : admins.length === 0 ? (
                            <p>No admins found</p>
                        ) : (
                            <div className={styler.cashiersGrid}>
                                {admins.map((admin) => (
                                    <div
                                        key={admin.username}
                                        className={styler.cashierCard}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "16px 20px",
                                            gap: "16px",
                                            flexWrap: "wrap",
                                            background: theme.cardBg,
                                            border: theme.border,
                                            color: theme.pageText
                                        }}
                                    >
                                        <div style={{ flex: 1, minWidth: "200px" }}>
                                            <h3 style={{ margin: 0 }}>{admin.full_name}</h3>
                                            <p style={{ margin: "4px 0", color: theme.mutedText }}>@{admin.username}</p>
                                            <p style={{ margin: 0, color: theme.mutedText }}>{admin.email}</p>
                                        </div>

                                        <button
                                            className={styler.deleteButton}
                                            style={{ flexShrink: 0 }}
                                            onClick={() => openDeleteModal(admin.username)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </main>
            </div>

            {adminToDelete && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: theme.modalOverlay,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "20px",
                        zIndex: 1000
                    }}
                >
                    <div
                        style={{
                            width: "100%",
                            maxWidth: "460px",
                            borderRadius: "14px",
                            padding: "24px",
                            background: theme.cardBg,
                            color: theme.pageText,
                            border: theme.border,
                            boxShadow: "0 20px 45px rgba(0,0,0,0.28)"
                        }}
                    >
                        <h3 style={{ margin: 0 }}>Delete Admin</h3>
                        <p style={{ marginTop: "10px", marginBottom: "18px", color: theme.mutedText }}>
                            Are you sure you want to delete <strong>@{adminToDelete}</strong>? This action cannot be undone.
                        </p>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                style={{
                                    border: theme.cancelBorder,
                                    borderRadius: "8px",
                                    padding: "8px 14px",
                                    background: "transparent",
                                    color: "inherit",
                                    cursor: "pointer"
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDelete(adminToDelete)}
                                style={{
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "8px 14px",
                                    background: "#b91c1c",
                                    color: "#ffffff",
                                    cursor: "pointer"
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}