"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import styles from "@/styles/workspace.module.css";

export default function TodoView({ 
  tasks, 
  darkMode, 
  onAddTask, 
  onUpdateTask, 
  onDeleteTask,
  onToggleComplete 
}) {
  const accentGradient = "linear-gradient(135deg, #2c6e7e 0%, #d4a549 100%)";
  const [viewMode, setViewMode] = useState("list"); // "list" or "card"
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewingTask, setViewingTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    priority: "medium",
    category: "Work"
  });

  // Filter tasks based on search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    
    const query = searchQuery.toLowerCase();
    return tasks.filter(task => 
      task.title?.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query) ||
      task.category?.toLowerCase().includes(query)
    );
  }, [tasks, searchQuery]);

  // Group tasks by date
  const groupedTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const groups = {
      today: [],
      upcoming: [],
      completed: []
    };
    
    filteredTasks.forEach(task => {
      if (task.completed) {
        groups.completed.push(task);
      } else if (task.date) {
        const taskDate = new Date(task.date);
        taskDate.setHours(0, 0, 0, 0);
        
        if (taskDate.getTime() === today.getTime()) {
          groups.today.push(task);
        } else {
          groups.upcoming.push(task);
        }
      } else {
        groups.upcoming.push(task);
      }
    });
    
    return groups;
  }, [filteredTasks]);

  const handleAddTask = () => {
    // Validate required fields
    if (!newTask.title.trim()) {
      alert("Title is required");
      return;
    }
    if (!newTask.date) {
      alert("Date is required");
      return;
    }
    if (!newTask.priority) {
      alert("Priority is required");
      return;
    }
    if (!newTask.category) {
      alert("Category is required");
      return;
    }
    
    onAddTask({
      ...newTask,
      completed: false
    });
    
    setNewTask({
      title: "",
      description: "",
      date: "",
      time: "",
      priority: "medium",
      category: "Work"
    });
    
    setShowAddModal(false);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowEditModal(true);
  };

  const handleUpdateTask = () => {
    // Validate required fields
    if (!editingTask.title.trim()) {
      alert("Title is required");
      return;
    }
    if (!editingTask.date) {
      alert("Date is required");
      return;
    }
    if (!editingTask.priority) {
      alert("Priority is required");
      return;
    }
    if (!editingTask.category) {
      alert("Category is required");
      return;
    }

    onUpdateTask(editingTask.id, editingTask);
    
    setEditingTask(null);
    setShowEditModal(false);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return darkMode ? "#ff6b6b" : "#e74c3c";
      case "medium":
        return darkMode ? "#ffd43b" : "#f39c12";
      case "low":
        return darkMode ? "#51cf66" : "#27ae60";
      default:
        return darkMode ? "#4dabf7" : "#3498db";
    }
  };

  const getCategoryColor = (category) => {
    switch (category?.toLowerCase()) {
      case "work":
        return darkMode ? "#ff9966" : "#ff7043";
      case "shopping":
        return darkMode ? "#ffd43b" : "#f39c12";
      case "health & fitness":
        return darkMode ? "#ff6b9d" : "#e91e63";
      default:
        return darkMode ? "#4dabf7" : "#3498db";
    }
  };

  const TaskItem = ({ task, isCardView = false, onEditTask, onDeleteTask, onToggleComplete, isCompleted = false }) => {
    const handleViewTask = () => {
      setViewingTask(task);
      setShowDetailModal(true);
    };
    
    if (isCardView) {
      return (
        <div
          className={styles.taskCard}
          style={{
            background: darkMode ? "#252525" : "#ffffff",
            border: `1px solid ${darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(44, 110, 126, 0.2)"}`,
            borderLeft: `4px solid ${getPriorityColor(task.priority)}`,
            borderRadius: "8px",
            padding: "16px",
            opacity: task.completed ? 0.6 : 1,
            transition: "all 0.2s ease",
            cursor: "pointer",
            height: "100%"
          }}
          onClick={handleViewTask}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ flex: 1 }}></div>
            
            <input
              type="checkbox"
              checked={task.completed || false}
              onChange={(e) => {
                e.stopPropagation();
                onToggleComplete(task.id);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "20px",
                height: "20px",
                cursor: "pointer",
                accentColor: darkMode ? "#d4a549" : "#2c6e7e",
                borderRadius: "50%"
              }}
            />
          </div>
          
          <h3 style={{
            color: darkMode ? "#ffffff" : "#1a4a52",
            fontSize: "16px",
            fontWeight: "600",
            textDecoration: task.completed ? "line-through" : "none",
            margin: "0 0 12px 0"
          }}>
            {task.title}
          </h3>
          
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
            {task.category && (
              <span style={{
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: "500",
                background: getCategoryColor(task.category),
                color: "#ffffff"
              }}>
                {task.category}
              </span>
            )}
            
            {task.date && (
              <span style={{
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: "500",
                background: darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(44, 110, 126, 0.08)",
                color: darkMode ? "#999" : "#666",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}>
                <Image
                  src="/vectors/calendar.png"
                  alt="Date"
                  width={12}
                  height={12}
                  style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.75)" : "none" }}
                />
                {task.date === new Date().toISOString().split('T')[0] ? 'Today' : new Date(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
            
            {task.time && (
              <span style={{
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: "500",
                background: darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(44, 110, 126, 0.08)",
                color: darkMode ? "#999" : "#666",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}>
                🕐 {task.time}
              </span>
            )}
          </div>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
            <span style={{
              padding: "4px 12px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: "600",
              textTransform: "uppercase",
              background: getPriorityColor(task.priority),
              color: "#ffffff"
            }}>
              {task.priority}
            </span>
            
            <div style={{ display: "flex", gap: "8px" }} onClick={(e) => e.stopPropagation()}>
              {!isCompleted && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTask(task);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "transparent",
                    border: "none",
                    color: darkMode ? "#4dabf7" : "#3498db",
                    cursor: "pointer",
                    fontSize: "16px",
                    padding: "4px 8px"
                  }}
                  title="Edit task"
                >
                  <Image
                    src="/vectors/edit_todo.png"
                    alt="Edit"
                    width={16}
                    height={16}
                    style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.75)" : "none" }}
                  />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTask(task.id);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: darkMode ? "#ff6b6b" : "#e74c3c",
                  cursor: "pointer",
                  fontSize: "20px",
                  padding: "4px 8px"
                }}
                title="Delete task"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    // List view
    return (
      <div
        className={styles.taskListItem}
        style={{
          background: darkMode ? "#252525" : "#ffffff",
          border: `1px solid ${darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(44, 110, 126, 0.2)"}`,
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "8px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          opacity: task.completed ? 0.6 : 1,
          transition: "all 0.2s ease",
          cursor: "pointer"
        }}
        onClick={handleViewTask}
      >
        <input
          type="checkbox"
          checked={task.completed || false}
          onChange={(e) => {
            e.stopPropagation();
            onToggleComplete(task.id);
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "20px",
            height: "20px",
            cursor: "pointer",
            accentColor: darkMode ? "#d4a549" : "#2c6e7e"
          }}
        />
        
        <div
          style={{
            width: "4px",
            height: "40px",
            borderRadius: "2px",
            background: getPriorityColor(task.priority)
          }}
        ></div>
        
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: "4px" }}>
            <span style={{
              color: darkMode ? "#ffffff" : "#1a4a52",
              fontSize: "15px",
              fontWeight: "500",
              textDecoration: task.completed ? "line-through" : "none"
            }}>
              {task.title}
            </span>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "13px" }}>
            {task.date && (
              <span style={{ color: darkMode ? "#999" : "#666", display: "flex", alignItems: "center", gap: "4px" }}>
                <Image
                  src="/vectors/calendar.png"
                  alt="Date"
                  width={13}
                  height={13}
                  style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.75)" : "none" }}
                />
                {new Date(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            
            {task.time && (
              <span style={{ color: darkMode ? "#999" : "#666" }}>
                🕐 {task.time}
              </span>
            )}
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {task.category && (
            <span style={{
              padding: "4px 10px",
              borderRadius: "10px",
              fontSize: "11px",
              fontWeight: "500",
              background: getCategoryColor(task.category),
              color: "#ffffff"
            }}>
              {task.category}
            </span>
          )}
          
          <span style={{
            padding: "4px 10px",
            borderRadius: "8px",
            fontSize: "11px",
            fontWeight: "600",
            textTransform: "uppercase",
            background: getPriorityColor(task.priority),
            color: "#ffffff"
          }}>
            {task.priority}
          </span>
        </div>
        
        <div style={{ display: "flex", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
          {!isCompleted && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditTask(task);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                color: darkMode ? "#4dabf7" : "#3498db",
                cursor: "pointer",
                fontSize: "16px",
                padding: "4px 8px"
              }}
              title="Edit task"
            >
              <Image
                src="/vectors/edit_todo.png"
                alt="Edit"
                width={16}
                height={16}
                style={{ objectFit: "contain", filter: darkMode ? "brightness(0) invert(0.75)" : "none" }}
              />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTask(task.id);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: darkMode ? "#ff6b6b" : "#e74c3c",
              cursor: "pointer",
              fontSize: "20px",
              padding: "4px 8px"
            }}
            title="Delete task"
          >
            ×
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.todoContainer}>
      {/* Header with search and controls */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
        gap: "16px",
        flexWrap: "wrap"
      }}>
        <div style={{ flex: "1 1 300px" }}>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: "8px",
              border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
              background: darkMode ? "#252525" : "#ffffff",
              color: darkMode ? "#ffffff" : "#1a4a52",
              fontSize: "14px",
              outline: "none"
            }}
          />
        </div>
        
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {/* View Toggle */}
          <div style={{
            display: "flex",
            gap: "8px",
            padding: "4px",
            background: darkMode ? "#252525" : "#f8f9fa",
            borderRadius: "8px",
            border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)"
          }}>
            <button
              onClick={() => setViewMode("list")}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "6px",
                background: viewMode === "list" ? accentGradient : "transparent",
                color: viewMode === "list" ? "#ffffff" : (darkMode ? "#ffffff" : "#2c6e7e"),
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                transition: "all 0.2s ease"
              }}
            >
              ☰ List
            </button>
            <button
              onClick={() => setViewMode("card")}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "6px",
                background: viewMode === "card" ? accentGradient : "transparent",
                color: viewMode === "card" ? "#ffffff" : (darkMode ? "#ffffff" : "#2c6e7e"),
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                transition: "all 0.2s ease"
              }}
            >
              ▦ Card
            </button>
          </div>
          
          {/* Add Task Button */}
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: accentGradient,
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease"
            }}
          >
            <span style={{ fontSize: "18px" }}>+</span> Add Task
          </button>
        </div>
      </div>

      {/* Task Stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
        marginBottom: "24px"
      }}>
        <div style={{
          padding: "16px",
          borderRadius: "8px",
          background: darkMode ? "#252525" : "#ffffff",
          border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)"
        }}>
          <div style={{ color: darkMode ? "#999" : "#666", fontSize: "13px", marginBottom: "4px" }}>All Tasks</div>
          <div style={{ color: darkMode ? "#ffffff" : "#1a4a52", fontSize: "24px", fontWeight: "700" }}>
            {tasks.length}
          </div>
        </div>
        
        <div style={{
          padding: "16px",
          borderRadius: "8px",
          background: darkMode ? "#252525" : "#ffffff",
          border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)"
        }}>
          <div style={{ color: darkMode ? "#999" : "#666", fontSize: "13px", marginBottom: "4px" }}>Today</div>
          <div style={{ color: darkMode ? "#ffffff" : "#1a4a52", fontSize: "24px", fontWeight: "700" }}>
            {groupedTasks.today.length}
          </div>
        </div>
        
        <div style={{
          padding: "16px",
          borderRadius: "8px",
          background: darkMode ? "#252525" : "#ffffff",
          border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)"
        }}>
          <div style={{ color: darkMode ? "#999" : "#666", fontSize: "13px", marginBottom: "4px" }}>Completed</div>
          <div style={{ color: darkMode ? "#51cf66" : "#27ae60", fontSize: "24px", fontWeight: "700" }}>
            {tasks.filter(t => t.completed).length}
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div style={{
        background: darkMode ? "#1a1a1a" : "#f8f9fa",
        borderRadius: "12px",
        padding: "24px",
        minHeight: "400px"
      }}>
        {/* Today Tasks */}
        {groupedTasks.today.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
              paddingBottom: "8px",
              borderBottom: darkMode ? "2px solid rgba(255, 255, 255, 0.1)" : "2px solid rgba(44, 110, 126, 0.2)"
            }}>
              <h2 style={{
                color: darkMode ? "#ffffff" : "#1a4a52",
                fontSize: "18px",
                fontWeight: "700",
                margin: 0
              }}>
                Today
              </h2>
              <span style={{
                color: darkMode ? "#999" : "#666",
                fontSize: "14px"
              }}>
                {groupedTasks.today.length} task{groupedTasks.today.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div style={{ 
              display: "grid",
              gridTemplateColumns: viewMode === "card" ? "repeat(2, 1fr)" : "1fr",
              gap: "12px"
            }}>
              {groupedTasks.today.map(task => (
                <TaskItem key={task.id} task={task} isCardView={viewMode === "card"} onEditTask={handleEditTask} onDeleteTask={onDeleteTask} onToggleComplete={onToggleComplete} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Tasks */}
        {groupedTasks.upcoming.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
              paddingBottom: "8px",
              borderBottom: darkMode ? "2px solid rgba(255, 255, 255, 0.1)" : "2px solid rgba(44, 110, 126, 0.2)"
            }}>
              <h2 style={{
                color: darkMode ? "#ffffff" : "#1a4a52",
                fontSize: "18px",
                fontWeight: "700",
                margin: 0
              }}>
                Upcoming
              </h2>
              <span style={{
                color: darkMode ? "#999" : "#666",
                fontSize: "14px"
              }}>
                {groupedTasks.upcoming.length} task{groupedTasks.upcoming.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div style={{ 
              display: "grid",
              gridTemplateColumns: viewMode === "card" ? "repeat(2, 1fr)" : "1fr",
              gap: "12px"
            }}>
              {groupedTasks.upcoming.map(task => (
                <TaskItem key={task.id} task={task} isCardView={viewMode === "card"} onEditTask={handleEditTask} onDeleteTask={onDeleteTask} onToggleComplete={onToggleComplete} />
              ))}
            </div>
          </div>
        )}

        {/* Completed Tasks */}
        {groupedTasks.completed.length > 0 && (
          <div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
              paddingBottom: "8px",
              borderBottom: darkMode ? "2px solid rgba(255, 255, 255, 0.1)" : "2px solid rgba(44, 110, 126, 0.2)"
            }}>
              <h2 style={{
                color: darkMode ? "#ffffff" : "#1a4a52",
                fontSize: "18px",
                fontWeight: "700",
                margin: 0
              }}>
                Completed
              </h2>
              <span style={{
                color: darkMode ? "#999" : "#666",
                fontSize: "14px"
              }}>
                {groupedTasks.completed.length} task{groupedTasks.completed.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div style={{ 
              display: "grid",
              gridTemplateColumns: viewMode === "card" ? "repeat(2, 1fr)" : "1fr",
              gap: "12px"
            }}>
              {groupedTasks.completed.map(task => (
                <TaskItem key={task.id} task={task} isCardView={viewMode === "card"} onEditTask={handleEditTask} onDeleteTask={onDeleteTask} onToggleComplete={onToggleComplete} isCompleted={true} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredTasks.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: darkMode ? "#666" : "#999"
          }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📝</div>
            <p style={{ fontSize: "16px", margin: 0 }}>
              {searchQuery ? "No tasks found matching your search" : "No tasks yet. Create your first task!"}
            </p>
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          padding: "20px"
        }}
        onClick={() => setShowAddModal(false)}
        >
          <div style={{
            background: darkMode ? "#1a1a1a" : "#ffffff",
            borderRadius: "12px",
            padding: "32px",
            maxWidth: "500px",
            width: "100%",
            boxShadow: darkMode ? "0 8px 32px rgba(0, 0, 0, 0.8)" : "0 8px 32px rgba(0, 0, 0, 0.2)"
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              color: darkMode ? "#ffffff" : "#1a4a52",
              fontSize: "24px",
              fontWeight: "700",
              marginBottom: "24px",
              marginTop: 0
            }}>
              Add New Task
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{
                  display: "block",
                  color: darkMode ? "#ffffff" : "#1a4a52",
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "8px"
                }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Enter task title"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
                    background: darkMode ? "#252525" : "#ffffff",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: "block",
                  color: darkMode ? "#ffffff" : "#1a4a52",
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "8px"
                }}>
                  Description
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Enter task description"
                  rows="3"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
                    background: darkMode ? "#252525" : "#ffffff",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit"
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{
                    display: "block",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    fontWeight: "600",
                    marginBottom: "8px"
                  }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={newTask.date}
                    onChange={(e) => setNewTask({ ...newTask, date: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
                      background: darkMode ? "#252525" : "#ffffff",
                      color: darkMode ? "#ffffff" : "#1a4a52",
                      fontSize: "14px",
                      outline: "none"
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: "block",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    fontWeight: "600",
                    marginBottom: "8px"
                  }}>
                    Time
                  </label>
                  <input
                    type="time"
                    value={newTask.time}
                    onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
                      background: darkMode ? "#252525" : "#ffffff",
                      color: darkMode ? "#ffffff" : "#1a4a52",
                      fontSize: "14px",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{
                    display: "block",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    fontWeight: "600",
                    marginBottom: "8px"
                  }}>
                    Priority
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
                      background: darkMode ? "#252525" : "#ffffff",
                      color: darkMode ? "#ffffff" : "#1a4a52",
                      fontSize: "14px",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label style={{
                    display: "block",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    fontWeight: "600",
                    marginBottom: "8px"
                  }}>
                    Category
                  </label>
                  <select
                    value={newTask.category}
                    onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
                      background: darkMode ? "#252525" : "#ffffff",
                      color: darkMode ? "#ffffff" : "#1a4a52",
                      fontSize: "14px",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="Work">Work</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Health & Fitness">Health & Fitness</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button
                  onClick={handleAddTask}
                  style={{
                    flex: 1,
                    padding: "12px 24px",
                    borderRadius: "8px",
                    border: "none",
                    background: accentGradient,
                    color: "#ffffff",
                    fontSize: "15px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  Add Task
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{
                    flex: 1,
                    padding: "12px 24px",
                    borderRadius: "8px",
                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
                    background: "transparent",
                    color: darkMode ? "#ffffff" : "#2c6e7e",
                    fontSize: "15px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditModal && editingTask && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          padding: "20px"
        }}>
          <div style={{
            background: darkMode ? "#1a1a1a" : "#ffffff",
            borderRadius: "16px",
            maxWidth: "500px",
            width: "100%",
            maxHeight: "90vh",
            overflow: "auto",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)"
          }}>
            <div style={{
              padding: "24px",
              borderBottom: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)"
            }}>
              <h2 style={{
                color: darkMode ? "#ffffff" : "#1a4a52",
                fontSize: "20px",
                fontWeight: "700",
                margin: 0
              }}>
                Edit Task
              </h2>
            </div>

            <div style={{ padding: "24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{
                  display: "block",
                  color: darkMode ? "#ffffff" : "#1a4a52",
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "8px"
                }}>
                  Title *
                </label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  placeholder="Enter task title"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
                    background: darkMode ? "#252525" : "#ffffff",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{
                  display: "block",
                  color: darkMode ? "#ffffff" : "#1a4a52",
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "8px"
                }}>
                  Description
                </label>
                <textarea
                  value={editingTask.description || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  placeholder="Enter description (optional)"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
                    background: darkMode ? "#252525" : "#ffffff",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{
                    display: "block",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    fontWeight: "600",
                    marginBottom: "8px"
                  }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    value={editingTask.date}
                    onChange={(e) => setEditingTask({ ...editingTask, date: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
                      background: darkMode ? "#252525" : "#ffffff",
                      color: darkMode ? "#ffffff" : "#1a4a52",
                      fontSize: "14px",
                      outline: "none"
                    }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{
                    display: "block",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    fontWeight: "600",
                    marginBottom: "8px"
                  }}>
                    Time
                  </label>
                  <input
                    type="time"
                    value={editingTask.time || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, time: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
                      background: darkMode ? "#252525" : "#ffffff",
                      color: darkMode ? "#ffffff" : "#1a4a52",
                      fontSize: "14px",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{
                    display: "block",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    fontWeight: "600",
                    marginBottom: "8px"
                  }}>
                    Priority *
                  </label>
                  <select
                    value={editingTask.priority}
                    onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
                      background: darkMode ? "#252525" : "#ffffff",
                      color: darkMode ? "#ffffff" : "#1a4a52",
                      fontSize: "14px",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{
                    display: "block",
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    fontWeight: "600",
                    marginBottom: "8px"
                  }}>
                    Category *
                  </label>
                  <select
                    value={editingTask.category}
                    onChange={(e) => setEditingTask({ ...editingTask, category: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
                      background: darkMode ? "#252525" : "#ffffff",
                      color: darkMode ? "#ffffff" : "#1a4a52",
                      fontSize: "14px",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="Work">Work</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Health & Fitness">Health & Fitness</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button
                  onClick={handleUpdateTask}
                  style={{
                    flex: 1,
                    padding: "12px 24px",
                    borderRadius: "8px",
                    border: "none",
                    background: darkMode ? "#d4a549" : "#2c6e7e",
                    color: "#ffffff",
                    fontSize: "15px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  Update Task
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingTask(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "12px 24px",
                    borderRadius: "8px",
                    border: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)",
                    background: "transparent",
                    color: darkMode ? "#ffffff" : "#2c6e7e",
                    fontSize: "15px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {showDetailModal && viewingTask && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          padding: "20px"
        }}
        onClick={() => {
          setShowDetailModal(false);
          setViewingTask(null);
        }}
        >
          <div style={{
            background: darkMode ? "#1a1a1a" : "#ffffff",
            borderRadius: "16px",
            maxWidth: "600px",
            width: "100%",
            maxHeight: "90vh",
            overflow: "auto",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)"
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: "24px",
              borderBottom: darkMode ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(44, 110, 126, 0.2)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "24px",
                    fontWeight: "700",
                    margin: "0 0 12px 0",
                    textDecoration: viewingTask.completed ? "line-through" : "none"
                  }}>
                    {viewingTask.title}
                  </h2>
                  
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                    {viewingTask.category && (
                      <span style={{
                        padding: "6px 14px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: "500",
                        background: getCategoryColor(viewingTask.category),
                        color: "#ffffff"
                      }}>
                        {viewingTask.category}
                      </span>
                    )}
                    
                    <span style={{
                      padding: "6px 14px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      background: getPriorityColor(viewingTask.priority),
                      color: "#ffffff"
                    }}>
                      {viewingTask.priority}
                    </span>
                    
                    {viewingTask.completed && (
                      <span style={{
                        padding: "6px 14px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: "500",
                        background: darkMode ? "#51cf66" : "#27ae60",
                        color: "#ffffff"
                      }}>
                        ✓ Completed
                      </span>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setViewingTask(null);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: darkMode ? "#999" : "#666",
                    cursor: "pointer",
                    fontSize: "28px",
                    padding: "0 8px",
                    lineHeight: "1"
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ padding: "24px" }}>
              {/* Date and Time */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                  {viewingTask.date && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "18px" }}>📅</span>
                      <div>
                        <div style={{
                          color: darkMode ? "#999" : "#666",
                          fontSize: "11px",
                          fontWeight: "600",
                          textTransform: "uppercase",
                          marginBottom: "2px"
                        }}>
                          Date
                        </div>
                        <div style={{
                          color: darkMode ? "#ffffff" : "#1a4a52",
                          fontSize: "14px",
                          fontWeight: "500"
                        }}>
                          {new Date(viewingTask.date).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {viewingTask.time && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "18px" }}>🕐</span>
                      <div>
                        <div style={{
                          color: darkMode ? "#999" : "#666",
                          fontSize: "11px",
                          fontWeight: "600",
                          textTransform: "uppercase",
                          marginBottom: "2px"
                        }}>
                          Time
                        </div>
                        <div style={{
                          color: darkMode ? "#ffffff" : "#1a4a52",
                          fontSize: "14px",
                          fontWeight: "500"
                        }}>
                          {viewingTask.time}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Description */}
              {viewingTask.description && (
                <div style={{ marginBottom: "20px" }}>
                  <h3 style={{
                    color: darkMode ? "#ffffff" : "#1a4a52",
                    fontSize: "14px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    marginBottom: "8px"
                  }}>
                    Description
                  </h3>
                  <p style={{
                    color: darkMode ? "#ccc" : "#666",
                    fontSize: "15px",
                    lineHeight: "1.6",
                    margin: 0,
                    whiteSpace: "pre-wrap"
                  }}>
                    {viewingTask.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
