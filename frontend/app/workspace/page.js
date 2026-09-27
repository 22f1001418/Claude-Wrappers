"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import UserChatBot from "@/app/components/chatbot/UserChatBot";
import CalendarView from "@/app/components/workspace/CalendarView";
import TodoView from "@/app/components/workspace/TodoView";
import DashboardNavbar from "@/app/components/Navbar";
import DashboardSidebar from "@/app/components/Sidebar";
import styles from "@/styles/workspace.module.css";
import { fetchWithAuth, clearAuthStoragePreserveTheme } from "@/lib/auth";
import { useSyncedTheme } from "@/lib/theme";

export default function Workspace() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { darkMode, toggleTheme } = useSyncedTheme();
  const [activeView, setActiveView] = useState("calendar"); // "calendar" or "todo"
  const [tasks, setTasks] = useState([]);
  const accentGradient = "linear-gradient(135deg, #2c6e7e 0%, #d4a549 100%)";

  // Fetch tasks from database
  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    try {
      const response = await fetchWithAuth("http://localhost:5001/api/todos", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Convert backend format to frontend format
          const formattedTasks = data.todos.map(todo => ({
            id: todo.todo_id,
            title: todo.title,
            description: todo.description,
            date: todo.date,
            time: todo.time,
            priority: todo.priority,
            category: todo.category,
            tags: todo.tags || [],
            completed: todo.completed,
            createdAt: todo.created_at,
            updatedAt: todo.updated_at
          }));
          setTasks(formattedTasks);
        }
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      router.replace("/login");
    }

    // Load tasks from localStorage
    const savedTasks = localStorage.getItem('workspace_tasks');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }

    setLoading(false);
  }, [router]);

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

  // Save tasks whenever they change
  useEffect(() => {
    if (tasks.length >= 0) {
      localStorage.setItem('workspace_tasks', JSON.stringify(tasks));
    }
  }, [tasks]);

  const handleAddTask = async (newTask) => {
    try {
      const response = await fetchWithAuth("http://localhost:5001/api/todos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newTask),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          await fetchTasks(); // Refresh tasks from server
        }
      } else {
        const error = await response.json();
        alert(error.message || "Failed to create task");
      }
    } catch (error) {
      console.error("Error creating task:", error);
      alert("Failed to create task");
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      const response = await fetchWithAuth(`http://localhost:5001/api/todos/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          await fetchTasks(); // Refresh tasks from server
        }
      } else {
        const error = await response.json();
        alert(error.message || "Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Failed to update task");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const response = await fetchWithAuth(`http://localhost:5001/api/todos/${taskId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        await fetchTasks(); // Refresh tasks from server
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Failed to delete task");
    }
  };

  const handleToggleComplete = async (taskId) => {
    try {
      const response = await fetchWithAuth(`http://localhost:5001/api/todos/${taskId}/toggle`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        await fetchTasks(); // Refresh tasks from server
      }
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  };

  if (loading) return null;
  if (!user) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <DashboardNavbar 
        darkMode={darkMode} 
        toggleTheme={toggleTheme} 
        handleProfileClick={handleProfileClick}
        user={user}
      />

      {/* CONTENT AREA - Sidebar + Main */}
      <div style={{ display: "flex", marginTop: "70px" }}>
        <DashboardSidebar 
          darkMode={darkMode} 
          user={user} 
          handleSignOut={handleSignOut} 
          handleProfileClick={handleProfileClick} 
        />

        {/* MAIN CONTENT */}
        <div style={{ marginLeft: "250px", width: "calc(100% - 250px)", padding: "30px" }}>
          <div className={styles.workspaceContainer}>
            <div className={styles.header}>
              <h1 className={styles.title} style={{ color: darkMode ? "#ffffff" : "#1a4a52" }}>
                Workspace
              </h1>
              
              <div className={styles.viewToggle} style={{
                background: darkMode ? "#121212" : "#ffffff",
                borderColor: darkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(44, 110, 126, 0.15)"
              }}>
                <button
                  className={`${styles.toggleButton} ${activeView === "calendar" ? styles.active : ""} ${activeView === "calendar" ? "mode-toggle-active" : ""}`}
                  onClick={() => setActiveView("calendar")}
                  style={{
                    background: activeView === "calendar"
                      ? (darkMode ? "rgba(212, 165, 73, 0.18)" : accentGradient)
                      : (darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(44, 110, 126, 0.1)"),
                    color: activeView === "calendar"
                      ? (darkMode ? "#f8fafc" : "#ffffff")
                      : (darkMode ? "#ffffff" : "#2c6e7e"),
                    border: activeView === "calendar"
                      ? (darkMode ? "1px solid rgba(212, 165, 73, 0.55)" : "1px solid transparent")
                      : (darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)"),
                    boxShadow: activeView === "calendar" && darkMode ? "0 0 0 1px rgba(212, 165, 73, 0.18)" : "none"
                  }}
                >
                  <Image
                    src="/vectors/calendar.png"
                    alt="Calendar"
                    width={18}
                    height={18}
                    style={{
                      objectFit: "contain",
                      filter: activeView === "calendar" ? "brightness(0) invert(1)" : "brightness(0) saturate(100%)"
                    }}
                  />
                  <span>Calendar</span>
                </button>
                <button
                  className={`${styles.toggleButton} ${activeView === "todo" ? styles.active : ""} ${activeView === "todo" ? "mode-toggle-active" : ""}`}
                  onClick={() => setActiveView("todo")}
                  style={{
                    background: activeView === "todo"
                      ? (darkMode ? "rgba(212, 165, 73, 0.18)" : accentGradient)
                      : (darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(44, 110, 126, 0.1)"),
                    color: activeView === "todo"
                      ? (darkMode ? "#f8fafc" : "#ffffff")
                      : (darkMode ? "#ffffff" : "#2c6e7e"),
                    border: activeView === "todo"
                      ? (darkMode ? "1px solid rgba(212, 165, 73, 0.55)" : "1px solid transparent")
                      : (darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)"),
                    boxShadow: activeView === "todo" && darkMode ? "0 0 0 1px rgba(212, 165, 73, 0.18)" : "none"
                  }}
                >
                  <Image
                    src="/vectors/todo.png"
                    alt="To-Do"
                    width={18}
                    height={18}
                    style={{
                      objectFit: "contain",
                      filter: activeView === "todo" ? "brightness(0) invert(1)" : "brightness(0) saturate(100%)"
                    }}
                  />
                  <span>To-Do</span>
                </button>
              </div>
            </div>

            <div className={styles.viewContainer}>
              {activeView === "calendar" ? (
                <CalendarView 
                  tasks={tasks} 
                  darkMode={darkMode}
                  onTaskClick={(task) => {
                    setActiveView("todo");
                  }}
                />
              ) : (
                <TodoView 
                  tasks={tasks}
                  darkMode={darkMode}
                  onAddTask={handleAddTask}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  onToggleComplete={handleToggleComplete}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CHATBOT */}
      <UserChatBot darkMode={darkMode} />
    </div>
  );
}
