"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import { getBackendUrl } from "@/lib/backend_url";
import { fetchWithAuth, clearAuthStoragePreserveTheme } from "@/lib/auth";
import { useSyncedTheme } from "@/lib/theme";

export default function NewProductCategoryPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [user, setUser] = useState(null);
  const { darkMode, toggleTheme } = useSyncedTheme();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const theme = darkMode
    ? {
        pageBg: "#0a0a0a",
        pageText: "#f3f4f6",
        mutedText: "#cbd5e1",
        cardBg: "#121212",
        cardBorder: "1px solid rgba(148, 163, 184, 0.28)",
        accentGradient: "linear-gradient(135deg, #2c6e7e 0%, #d4a549 100%)",
        dropzoneBg: "linear-gradient(135deg, rgba(44, 110, 126, 0.22), rgba(212, 165, 73, 0.18))",
        dropzoneBorder: "1px dashed rgba(148, 163, 184, 0.45)",
        accent: "#60a5fa",
        good: "#34d399",
        danger: "#f87171"
      }
    : {
        pageBg: "#faf8f5",
        pageText: "#0f172a",
        mutedText: "#475569",
        cardBg: "#ffffff",
        cardBorder: "1px solid rgba(15, 23, 42, 0.12)",
        accentGradient: "linear-gradient(135deg, #2c6e7e 0%, #d4a549 100%)",
        dropzoneBg: "linear-gradient(135deg, rgba(44, 110, 126, 0.12), rgba(212, 165, 73, 0.12))",
        dropzoneBorder: "1px dashed rgba(15, 23, 42, 0.18)",
        accent: "#2563eb",
        good: "#059669",
        danger: "#b91c1c"
      };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const storedUserRaw = localStorage.getItem("user");
    const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;

    if (!token) {
      router.replace("/login");
      return;
    }

    if (!storedUser || !["owner", "user"].includes(storedUser.role)) {
      router.replace("/dashboard");
      return;
    }

    setUser(storedUser);

    setLoading(false);
  }, [router]);

  const handleSignOut = async () => {
    try {
      await fetchWithAuth("http://localhost:5001/api/auth/logout", {
        method: "POST"
      });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      clearAuthStoragePreserveTheme();
      router.replace("/login");
    }
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
    setError("");
    setSuccess("");
  };

  const selectedCount = selectedFiles.length;

  const totalSizeText = useMemo(() => {
    const totalBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    if (!totalBytes) {
      return "0 KB";
    }

    const mb = totalBytes / (1024 * 1024);
    if (mb >= 1) {
      return `${mb.toFixed(2)} MB`;
    }

    return `${(totalBytes / 1024).toFixed(1)} KB`;
  }, [selectedFiles]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (selectedFiles.length < 10) {
      setError("Please select at least 10 images for a single batch.");
      return;
    }

    try {
      setSubmitting(true);
      const url = await getBackendUrl();
      const formData = new FormData();

      selectedFiles.forEach((file) => {
        formData.append("images", file);
      });

      const response = await fetchWithAuth(`${url}/api/unknown-items/upload`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Upload failed");
      }

      setSuccess(`${result.data.class_name} saved with ${result.data.count} images.`);
      setSelectedFiles([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err.message || "Something went wrong while uploading the batch.");
    } finally {
      setSubmitting(false);
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
          <div style={{ maxWidth: "1040px" }}>
            <div style={{ marginBottom: "24px" }}>
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  backgroundImage: theme.accentGradient,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent"
                }}
              >
                Owner workflow
              </p>
              <h1 style={{ margin: "8px 0 10px", fontSize: "40px", lineHeight: 1.1 }}>New Product Category</h1>
              <p style={{ margin: 0, color: theme.mutedText, maxWidth: "760px", fontSize: "16px" }}>
                Upload a batch of product images from your device.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.35fr) minmax(300px, 0.65fr)",
                gap: "20px",
                alignItems: "start"
              }}
            >
              <form
                onSubmit={handleSubmit}
                style={{
                  background: theme.cardBg,
                  border: theme.cardBorder,
                  borderRadius: "20px",
                  padding: "24px",
                  boxShadow: darkMode ? "0 24px 60px rgba(0, 0, 0, 0.35)" : "0 24px 60px rgba(15, 23, 42, 0.08)"
                }}
              >
                <div
                  style={{
                    border: theme.dropzoneBorder,
                    borderRadius: "18px",
                    padding: "28px",
                    background: theme.dropzoneBg,
                    textAlign: "center"
                  }}
                >
                  <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Select 10 or more images</div>
                  <div style={{ color: theme.mutedText, marginBottom: "16px" }}>
                    Use different angles so the admin can annotate the item accurately later.
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "12px",
                      background: darkMode ? "#121212" : "#ffffff",
                      color: theme.pageText,
                      border: "1px solid rgba(148, 163, 184, 0.3)"
                    }}
                  />

                  <div style={{ marginTop: "14px", color: theme.mutedText, fontSize: "14px" }}>
                    Selected: {selectedCount} image{selectedCount === 1 ? "" : "s"} · Total size: {totalSizeText}
                  </div>
                </div>

                {error && (
                  <div style={{ marginTop: "16px", color: theme.danger, fontWeight: 600 }}>
                    {error}
                  </div>
                )}

                {success && (
                  <div style={{ marginTop: "16px", color: theme.good, fontWeight: 600 }}>
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    marginTop: "18px",
                    width: "100%",
                    padding: "14px 18px",
                    borderRadius: "14px",
                    border: "none",
                    background: submitting ? "#94a3b8" : theme.accentGradient,
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "15px",
                    cursor: submitting ? "not-allowed" : "pointer"
                  }}
                >
                  {submitting ? "Uploading batch..." : "Create Unknown Item Batch"}
                </button>
              </form>

              <aside
                style={{
                  background: theme.cardBg,
                  border: theme.cardBorder,
                  borderRadius: "20px",
                  padding: "24px",
                  boxShadow: darkMode ? "0 24px 60px rgba(0, 0, 0, 0.35)" : "0 24px 60px rgba(15, 23, 42, 0.08)"
                }}
              >
                <h2 style={{ marginTop: 0 }}>Batch rules</h2>
                <ul style={{ margin: 0, paddingLeft: "18px", color: theme.mutedText, lineHeight: 1.7 }}>
                  <li>Upload at least 10 images for each batch.</li>
                  <li>Make sure the images are captured from different angles.</li>
                  <li>The product name should be clearly visible in the images.</li>
                  <li>Use good lighting so the product is easy to see.</li>
                </ul>

                <div style={{ marginTop: "22px", padding: "16px", borderRadius: "16px", background: darkMode ? "linear-gradient(135deg, rgba(44, 110, 126, 0.22), rgba(212, 165, 73, 0.18))" : "linear-gradient(135deg, rgba(44, 110, 126, 0.12), rgba(212, 165, 73, 0.12))" }}>
                  <div style={{ fontWeight: 700, marginBottom: "8px" }}>Current batch</div>
                  <div style={{ color: theme.mutedText, fontSize: "14px" }}>
                    {selectedCount > 0 ? (
                      <>
                        {selectedFiles.slice(0, 8).map((file) => file.name).join(", ")}
                        {selectedFiles.length > 8 ? "..." : ""}
                      </>
                    ) : (
                      "No files selected yet."
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}