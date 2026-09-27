"use client";
import React, { useState, useEffect } from "react";
import { getBackendUrl } from "@/lib/backend_url";

const InventoryModal = ({ isOpen, onClose, token, refreshProducts }) => {
    const [mode, setMode] = useState("add");
    const [availableProducts, setAvailableProducts] = useState([]);
    const [inventoryProducts, setInventoryProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const fetchAvailableProducts = async () => {
        const url = await getBackendUrl();
        const res = await fetch(`${url}/api/inventory/available-products`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || "Failed to load listed products");
        }

        setAvailableProducts(data.products || []);
    };

    const fetchInventoryProducts = async () => {
        const url = await getBackendUrl();
        const res = await fetch(`${url}/api/inventory/products`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || "Failed to load inventory products");
        }

        setInventoryProducts(data.products || []);
    };

    const [form, setForm] = useState({
        class_name: "",
        product_name: "",
        brand: "",
        unit_price: "",
        stock: "",
        product_id: ""
    });

    // Reset form when mode changes
    useEffect(() => {
        setForm({
            class_name: "",
            product_name: "",
            brand: "",
            unit_price: "",
            stock: "",
            product_id: ""
        });
        setErrors({});
    }, [mode]);

    // Fetch listed products that are not already in this owner's inventory
    useEffect(() => {
        if (!isOpen || !token || mode !== "add") return;

        fetchAvailableProducts().catch((err) => {
            console.error(err);
            setAvailableProducts([]);
            alert("Unable to load listed categories");
        });
    }, [isOpen, mode, token]);

    // Fetch products already present in this owner's inventory for update/delete
    useEffect(() => {
        if (!isOpen || !token || mode === "add") return;

        fetchInventoryProducts().catch((err) => {
            console.error(err);
            setInventoryProducts([]);
            alert("Unable to load inventory products");
        });
    }, [isOpen, mode, token]);

    const handleSubmit = async () => {
        if (!token) return alert("No auth token");

        setLoading(true);

        try {
            const url = await getBackendUrl();

            if (mode === "add") {
                const fieldErrors = {
                    class_name: form.class_name ? "" : "This field is mandatory",
                    product_name: form.product_name ? "" : "This field is mandatory",
                    brand: form.brand ? "" : "This field is mandatory",
                    unit_price: form.unit_price ? "" : "This field is mandatory",
                    stock: form.stock ? "" : "This field is mandatory"
                };

                setErrors(fieldErrors);

                if (Object.values(fieldErrors).some(Boolean)) {
                    setLoading(false);
                    return;
                }

                const response = await fetch(`${url}/api/inventory/add-product`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(form)
                });

                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Failed to add product");
                }
            }

            if (mode === "update") {
                const fieldErrors = {
                    product_id: form.product_id ? "" : "This field is mandatory",
                    unit_price: form.unit_price ? "" : "This field is mandatory",
                    stock: form.stock ? "" : "This field is mandatory"
                };

                setErrors(fieldErrors);

                if (Object.values(fieldErrors).some(Boolean)) {
                    setLoading(false);
                    return;
                }

                const response = await fetch(`${url}/api/inventory/update-product/${form.product_id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(form)
                });

                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Failed to update product");
                }
            }

            if (mode === "delete") {
                if (!form.product_id) {
                    return alert("Select a product to delete");
                }

                await fetch(`${url}/api/inventory/delete-product/${form.product_id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            refreshProducts();
            onClose();

        } catch (err) {
            console.error(err);
            alert("Something went wrong");
        }

        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>

                <h2 style={titleStyle}>Inventory Management</h2>

                {/* MODE SELECT */}
                <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    style={selectStyle}
                >
                    <option value="add">Add Product</option>
                    <option value="update">Update Product</option>
                    <option value="delete">Delete Product</option>
                </select>

                {/* ADD */}
                {mode === "add" && (
                    <>
                        <select
                            value={form.class_name}
                            onChange={(e) => {
                                const selected = availableProducts.find(
                                    p => p.class_name === e.target.value
                                );
                                if (!selected) return;
                                setForm({
                                    ...form,
                                    class_name: selected.class_name
                                });
                                if (errors.class_name) {
                                    setErrors({ ...errors, class_name: "" });
                                }
                            }}
                            style={{
                                ...selectStyle,
                                border: errors.class_name ? "1px solid #ef4444" : selectStyle.border
                            }}
                        >
                            <option value="">Select Category</option>
                            {availableProducts.map(p => (
                                <option key={p.item_id} value={p.class_name}>
                                    {p.class_name}
                                </option>
                            ))}
                        </select>
                        {errors.class_name && <p style={errorTextStyle}>{errors.class_name}</p>}

                        <input
                            placeholder="Product Name"
                            style={{
                                ...inputStyle,
                                border: errors.product_name ? "1px solid #ef4444" : inputStyle.border
                            }}
                            value={form.product_name}
                            onChange={(e) => {
                                setForm({ ...form, product_name: e.target.value });
                                if (errors.product_name) {
                                    setErrors({ ...errors, product_name: "" });
                                }
                            }}
                        />
                        {errors.product_name && (
                            <p style={errorTextStyle}>{errors.product_name}</p>
                        )}

                        {availableProducts.length === 0 && (
                            <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>
                                All listed categories are already present in this inventory.
                            </p>
                        )}

                        <div style={rowStyle}>
                            <div style={fieldColumnStyle}>
                                <input
                                    placeholder="Brand"
                                    style={{
                                        ...inputStyle,
                                        border: errors.brand ? "1px solid #ef4444" : inputStyle.border
                                    }}
                                    value={form.brand}
                                    onChange={(e) => {
                                        setForm({ ...form, brand: e.target.value });
                                        if (errors.brand) {
                                            setErrors({ ...errors, brand: "" });
                                        }
                                    }}
                                />
                                {errors.brand && <p style={errorTextStyle}>{errors.brand}</p>}
                            </div>
                            <div style={fieldColumnStyle}>
                                <input
                                    placeholder="Price"
                                    type="number"
                                    style={{
                                        ...inputStyle,
                                        border: errors.unit_price ? "1px solid #ef4444" : inputStyle.border
                                    }}
                                    value={form.unit_price}
                                    onChange={(e) => {
                                        setForm({ ...form, unit_price: e.target.value });
                                        if (errors.unit_price) {
                                            setErrors({ ...errors, unit_price: "" });
                                        }
                                    }}
                                />
                                {errors.unit_price && <p style={errorTextStyle}>{errors.unit_price}</p>}
                            </div>
                        </div>

                        <input
                            placeholder="Stock"
                            type="number"
                            style={{
                                ...inputStyle,
                                border: errors.stock ? "1px solid #ef4444" : inputStyle.border
                            }}
                            onChange={(e) => {
                                setForm({ ...form, stock: e.target.value });
                                if (errors.stock) {
                                    setErrors({ ...errors, stock: "" });
                                }
                            }}
                        />
                        {errors.stock && <p style={errorTextStyle}>{errors.stock}</p>}
                    </>
                )}

                {/* UPDATE / DELETE */}
                {(mode === "update" || mode === "delete") && (
                    <div>
                        <select
                            style={{
                                ...selectStyle,
                                border: errors.product_id ? "1px solid #ef4444" : selectStyle.border
                            }}
                            value={form.product_id}
                            onChange={(e) => {
                                setForm({ ...form, product_id: e.target.value });
                                if (errors.product_id) {
                                    setErrors({ ...errors, product_id: "" });
                                }
                            }}
                        >
                            <option value="">Select Product</option>
                            {inventoryProducts.map(p => (
                                <option key={p.product_id} value={p.product_id}>
                                    {p.product_name}
                                </option>
                            ))}
                        </select>
                        {errors.product_id && <p style={errorTextStyle}>{errors.product_id}</p>}
                    </div>
                )}

                {(mode === "update" || mode === "delete") && inventoryProducts.length === 0 && (
                    <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>
                        No products found in this inventory.
                    </p>
                )}

                {/* UPDATE */}
                {mode === "update" && (
                    <div style={rowStyle}>
                        <div style={fieldColumnStyle}>
                            <input
                                placeholder="New Price"
                                type="number"
                                style={{
                                    ...inputStyle,
                                    border: errors.unit_price ? "1px solid #ef4444" : inputStyle.border
                                }}
                                value={form.unit_price}
                                onChange={(e) => {
                                    setForm({ ...form, unit_price: e.target.value });
                                    if (errors.unit_price) {
                                        setErrors({ ...errors, unit_price: "" });
                                    }
                                }}
                            />
                            {errors.unit_price && <p style={errorTextStyle}>{errors.unit_price}</p>}
                        </div>
                        <div style={fieldColumnStyle}>
                            <input
                                placeholder="New Stock"
                                type="number"
                                style={{
                                    ...inputStyle,
                                    border: errors.stock ? "1px solid #ef4444" : inputStyle.border
                                }}
                                value={form.stock}
                                onChange={(e) => {
                                    setForm({ ...form, stock: e.target.value });
                                    if (errors.stock) {
                                        setErrors({ ...errors, stock: "" });
                                    }
                                }}
                            />
                            {errors.stock && <p style={errorTextStyle}>{errors.stock}</p>}
                        </div>
                    </div>
                )}

                {/* BUTTONS */}
                <div style={buttonRow}>
                    <button style={submitBtn} onClick={handleSubmit}>
                        {loading ? "Processing..." : "Submit"}
                    </button>
                    <button style={cancelBtn} onClick={onClose}>
                        Cancel
                    </button>
                </div>

            </div>
        </div>
    );
};

const overlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000
};

const modalStyle = {
    background: "#ffffff",
    padding: "28px",
    borderRadius: "16px",
    width: "420px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    gap: "14px"
};

const titleStyle = {
    fontSize: "22px",
    fontWeight: "600",
    color: "#1a4a52",
    marginBottom: "6px"
};

const selectStyle = {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    fontSize: "14px"
};

const inputStyle = {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    fontSize: "14px",
    width: "100%"
};

const rowStyle = {
    display: "flex",
    gap: "10px"
};

const fieldColumnStyle = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "6px"
};

const buttonRow = {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "10px"
};

const submitBtn = {
    background: "linear-gradient(135deg, #2c6e7e, #d4a549)",
    color: "#fff",
    border: "none",
    padding: "10px 16px",
    borderRadius: "8px",
    cursor: "pointer"
};

const cancelBtn = {
    background: "#eee",
    border: "none",
    padding: "10px 16px",
    borderRadius: "8px",
    cursor: "pointer"
};

const errorTextStyle = {
    margin: "0",
    color: "#ef4444",
    fontSize: "12px",
    lineHeight: 1.3
};

export default InventoryModal;