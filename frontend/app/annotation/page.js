"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import { getBackendUrl } from "@/lib/backend_url";
import { useSyncedTheme } from "@/lib/theme";
import { clearAuthStoragePreserveTheme } from "@/lib/auth";

export default function AnnotationPage() {
  const router = useRouter();
  const { darkMode, toggleTheme } = useSyncedTheme();
  const accentGradient = "linear-gradient(135deg, #2c6e7e 0%, #d4a549 100%)";
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [classNameInput, setClassNameInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
        errorText: "#fecaca",
        goodText: "#86efac",
        primary: "#60a5fa"
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
        errorText: "#b91c1c",
        goodText: "#047857",
        primary: "#2563eb"
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
    setLoading(false);
    fetchBatches();
  }, [router]);

  const fetchBatches = async () => {
    try {
      setTableLoading(true);
      setError("");
      const url = await getBackendUrl();
      const token = localStorage.getItem("access_token");

      const res = await fetch(`${url}/api/unknown-items/`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch unknown batches");
      }

      setBatches(result.data.batches || []);
    } catch (err) {
      setBatches([]);
      setError(err.message || "Unable to load unknown item batches");
    } finally {
      setTableLoading(false);
    }
  };

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
      // Continue with local logout.
    } finally {
      clearAuthStoragePreserveTheme();
      router.replace("/login");
    }
  };

  const filteredBatches = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return batches;
    }

    return batches.filter((batch) => {
      const className = String(batch.class_name || "").toLowerCase();
      const id = String(batch.item_id || "").toLowerCase();
      return className.includes(query) || id.includes(query);
    });
  }, [batches, searchTerm]);

  const handleDownloadZip = async (itemId, className) => {
    try {
      setError("");
      setSuccess("");
      const url = await getBackendUrl();
      const token = localStorage.getItem("access_token");

      const response = await fetch(`${url}/api/unknown-items/${itemId}/download`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.message || "Failed to download zip");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `${className || `unknown_item_${itemId}`}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setSelectedBatch({ item_id: itemId, class_name: className || `unknown_item_${itemId}` });
      setClassNameInput(className || `unknown_item_${itemId}`);
      setSuccess("Zip downloaded. You can now add this class to Product Listing.");
    } catch (err) {
      setError(err.message || "Unable to download the selected batch");
    }
  };

  const handleCreateListedProduct = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const className = classNameInput.trim();
    if (!className) {
      setError("Please enter a class name before creating a listed product.");
      return;
    }

    try {
      setIsSubmitting(true);
      const url = await getBackendUrl();
      const token = localStorage.getItem("access_token");

      const response = await fetch(`${url}/api/admin-products/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ class_name: className })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create listed product");
      }

      setSuccess(`Created listed product: ${result.data.name}`);
      setClassNameInput("");
    } catch (err) {
      setError(err.message || "Unable to create listed product");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar darkMode={darkMode} toggleTheme={toggleTheme} user={user} />

      <div style={{ display: "flex", marginTop: "70px" }}>
        <Sidebar darkMode={darkMode} user={user} handleSignOut={handleSignOut} />

        <main
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
              display: "grid",
              gridTemplateColumns: "1.35fr 0.65fr",
              gap: "20px",
              alignItems: "start"
            }}
          >
            <section
              style={{
                background: theme.cardBg,
                border: theme.cardBorder,
                borderRadius: "14px",
                padding: "20px"
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
                <div>
                  <h2 style={{ margin: 0 }}>Annotation Tool</h2>
                  <p style={{ margin: "6px 0 0", color: theme.mutedText }}>
                    Download unknown item batches as zip files.
                  </p>
                </div>

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by batch name or ID"
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
                Showing {filteredBatches.length} of {batches.length} batches
              </p>

              <div
                style={{
                  marginTop: "12px",
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
                    minWidth: "680px"
                  }}
                >
                  <thead>
                    <tr style={{ background: theme.headerBg }}>
                      <th style={{ textAlign: "left", padding: "12px 16px" }}>#</th>
                      <th style={{ textAlign: "left", padding: "12px 16px" }}>Batch Name</th>
                      <th style={{ textAlign: "left", padding: "12px 16px" }}>Images</th>
                      <th style={{ textAlign: "left", padding: "12px 16px" }}>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {tableLoading ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "16px", textAlign: "center", color: theme.mutedText }}>
                          Loading batches...
                        </td>
                      </tr>
                    ) : filteredBatches.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "16px", textAlign: "center", color: theme.mutedText }}>
                          No unknown item batches available.
                        </td>
                      </tr>
                    ) : (
                      filteredBatches.map((batch, index) => (
                        <tr key={batch.item_id} style={{ borderTop: theme.rowBorder }}>
                          <td style={{ padding: "12px 16px" }}>{index + 1}</td>
                          <td style={{ padding: "12px 16px" }}>{batch.class_name || `unknown_item_${batch.item_id}`}</td>
                          <td style={{ padding: "12px 16px" }}>{batch.images_count ?? batch.count ?? 0}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <button
                              type="button"
                              onClick={() => handleDownloadZip(batch.item_id, batch.class_name)}
                              style={{
                                border: "none",
                                borderRadius: "8px",
                                padding: "8px 12px",
                                cursor: "pointer",
                                background: accentGradient,
                                color: "#ffffff",
                                fontWeight: 600
                              }}
                            >
                              Download Zip
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <aside
              style={{
                background: theme.cardBg,
                border: theme.cardBorder,
                borderRadius: "14px",
                padding: "20px"
              }}
            >
              <h3 style={{ marginTop: 0 }}>Create Product Listing</h3>
              <p style={{ margin: "6px 0 14px", color: theme.mutedText }}>
                After downloading and annotating, add the final class name to listed products.
              </p>

              <form onSubmit={handleCreateListedProduct}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "8px" }}>Class Name</label>
                <input
                  type="text"
                  value={classNameInput}
                  onChange={(e) => setClassNameInput(e.target.value)}
                  placeholder="Example: chips_lays_classic"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: theme.inputBorder,
                    background: theme.inputBg,
                    color: theme.inputText,
                    outline: "none"
                  }}
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    marginTop: "12px",
                    width: "100%",
                    border: "none",
                    borderRadius: "10px",
                    padding: "11px 14px",
                    background: isSubmitting ? "#94a3b8" : accentGradient,
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: isSubmitting ? "not-allowed" : "pointer"
                  }}
                >
                  {isSubmitting ? "Creating..." : "Add To Product Listing"}
                </button>
              </form>

              {selectedBatch && (
                <div
                  style={{
                    marginTop: "14px",
                    borderRadius: "10px",
                    padding: "12px",
                    background: darkMode ? "rgba(37, 99, 235, 0.14)" : "rgba(37, 99, 235, 0.08)",
                    color: theme.mutedText,
                    fontSize: "14px"
                  }}
                >
                  Selected batch: <strong style={{ color: theme.pageText }}>{selectedBatch.class_name}</strong>
                </div>
              )}

              {error && (
                <div style={{ marginTop: "12px", color: theme.errorText, fontWeight: 600 }}>
                  {error}
                </div>
              )}

              {success && (
                <div style={{ marginTop: "12px", color: theme.goodText, fontWeight: 600 }}>
                  {success}
                </div>
              )}
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
