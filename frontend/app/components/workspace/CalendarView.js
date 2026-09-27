"use client";

import { useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import styles from "@/styles/workspace.module.css";

export default function CalendarView({ tasks, darkMode, onTaskClick }) {
  const calendarRef = useRef(null);
  const [calendarKey, setCalendarKey] = useState(0);
  const accentGradient = "linear-gradient(135deg, #2c6e7e 0%, #d4a549 100%)";

  // Force re-render when theme changes
  useEffect(() => {
    setCalendarKey(prev => prev + 1);
  }, [darkMode]);

  // Convert tasks to calendar events
  const events = tasks
    .filter(task => task.date)
    .map(task => ({
      id: task.id,
      title: task.title,
      start: task.date,
      allDay: !task.time,
      backgroundColor: task.completed 
        ? (darkMode ? "#555" : "#ccc")
        : getPriorityColor(task.priority, darkMode),
      borderColor: task.completed 
        ? (darkMode ? "#555" : "#ccc")
        : getPriorityColor(task.priority, darkMode),
      extendedProps: {
        ...task
      }
    }));

  function getPriorityColor(priority, isDark) {
    switch (priority) {
      case "high":
        return isDark ? "#ff6b6b" : "#e74c3c";
      case "medium":
        return isDark ? "#ffd43b" : "#f39c12";
      case "low":
        return isDark ? "#51cf66" : "#27ae60";
      default:
        return isDark ? "#4dabf7" : "#3498db";
    }
  }

  const handleEventClick = (info) => {
    const task = info.event.extendedProps;
    if (onTaskClick) {
      onTaskClick(task);
    }
  };

  return (
    <div className={styles.calendarContainer} style={{
      background: darkMode ? "#1a1a1a" : "#ffffff",
      borderRadius: "12px",
      padding: "24px",
      boxShadow: darkMode ? "0 4px 20px rgba(0, 0, 0, 0.5)" : "0 4px 20px rgba(0, 0, 0, 0.1)",
    }}>
      <style jsx global>{`
        .fc {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        
        .fc-theme-standard {
          ${darkMode ? `
            --fc-border-color: rgba(255, 255, 255, 0.1);
            --fc-bg-event-opacity: 1;
          ` : `
            --fc-border-color: rgba(44, 110, 126, 0.2);
            --fc-bg-event-opacity: 1;
          `}
        }
        
        .fc .fc-toolbar-title {
          color: ${darkMode ? "#ffffff" : "#1a4a52"};
          font-size: 1.5em;
          font-weight: 600;
        }
        
        .fc .fc-button-group {
          background-image: ${accentGradient};
          border-radius: 8px;
          overflow: hidden;
        }

        .fc .fc-button {
          background: transparent;
          border: none;
          color: #ffffff;
          text-transform: capitalize;
          padding: 6px 12px;
          border-radius: 0;
          font-weight: 500;
        }

        .fc .fc-button:not(:last-child) {
          border-right: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .fc .fc-button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.12);
        }

        .fc .fc-today-button {
          border-radius: 8px !important;
          margin-left: 8px;
        }

        .fc .fc-today-button:not(:disabled) {
          background-image: ${accentGradient};
          background-color: transparent;
          color: #ffffff;
          border: none;
        }

        .fc .fc-today-button:not(:disabled):hover {
          filter: brightness(0.95);
          background: ${accentGradient};
        }

        .fc .fc-button:disabled {
          background: ${darkMode ? "#2c2c2c" : "#cbd5e1"};
          background-color: ${darkMode ? "#2c2c2c" : "#cbd5e1"};
          border-color: transparent;
          color: ${darkMode ? "#94a3b8" : "#64748b"};
          opacity: 0.9;
        }
        
        .fc .fc-button:focus {
          box-shadow: 0 0 0 3px ${darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(44, 110, 126, 0.2)"};
        }
        
        .fc .fc-button-active {
          background: rgba(255, 255, 255, 0.16);
          border-color: transparent;
        }
        
        .fc .fc-button-active:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        .fc .fc-col-header-cell {
          background-color: ${darkMode ? "#252525" : "#f8f9fa"};
          color: ${darkMode ? "#ffffff" : "#1a4a52"};
          font-weight: 600;
          padding: 12px 0;
        }
        
        .fc .fc-daygrid-day {
          background-color: ${darkMode ? "#1a1a1a" : "#ffffff"};
        }
        
        .fc .fc-daygrid-day:hover {
          background-color: ${darkMode ? "#252525" : "#f8f9fa"};
        }
        
        .fc .fc-daygrid-day-number {
          color: ${darkMode ? "#ffffff" : "#1a4a52"};
          padding: 8px;
          font-weight: 500;
        }
        
        .fc .fc-day-today {
          background-color: ${darkMode ? "rgba(212, 165, 73, 0.1)" : "rgba(44, 110, 126, 0.05)"} !important;
        }
        
        .fc .fc-day-today .fc-daygrid-day-number {
          color: ${darkMode ? "#d4a549" : "#2c6e7e"};
          font-weight: 700;
        }
        
        .fc .fc-event {
          cursor: pointer;
          border-radius: 4px;
          padding: 2px 4px;
          font-size: 0.85em;
          font-weight: 500;
          margin: 2px 0;
        }
        
        .fc .fc-event:hover {
          opacity: 0.8;
        }
        
        .fc .fc-daygrid-event-dot {
          display: none;
        }
        
        .fc .fc-event-time {
          font-weight: 600;
        }
        
        .fc .fc-daygrid-more-link {
          color: ${darkMode ? "#d4a549" : "#2c6e7e"};
          font-weight: 600;
        }
        
        .fc .fc-popover {
          background-color: ${darkMode ? "#2c2c2c" : "#ffffff"};
          border-color: ${darkMode ? "#3c3c3c" : "rgba(44, 110, 126, 0.2)"};
          box-shadow: ${darkMode ? "0 4px 20px rgba(0, 0, 0, 0.5)" : "0 4px 20px rgba(0, 0, 0, 0.1)"};
        }
        
        .fc .fc-popover-header {
          background-color: ${darkMode ? "#3c3c3c" : "#f8f9fa"};
          color: ${darkMode ? "#ffffff" : "#1a4a52"};
        }
        
        .fc .fc-popover-close {
          color: ${darkMode ? "#ffffff" : "#1a4a52"};
        }
        
        .fc-timegrid-slot {
          height: 3em;
        }
        
        .fc-scrollgrid {
          border-color: ${darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(44, 110, 126, 0.2)"};
        }
        
        .fc-scrollgrid td {
          border-color: ${darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(44, 110, 126, 0.1)"};
        }
      `}</style>
      
      <FullCalendar
        key={calendarKey}
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay"
        }}
        events={events}
        eventClick={handleEventClick}
        height="auto"
        contentHeight={600}
        eventDisplay="block"
        displayEventTime={false}
        displayEventEnd={false}
        dayMaxEvents={3}
        moreLinkText={(num) => `+${num} more`}
        weekends={true}
        editable={false}
        selectable={false}
        selectMirror={true}
        nowIndicator={true}
      />
      
      <div style={{
        marginTop: "20px",
        padding: "16px",
        background: darkMode ? "#252525" : "#f8f9fa",
        borderRadius: "8px",
        display: "flex",
        gap: "16px",
        flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "16px",
            height: "16px",
            borderRadius: "4px",
            background: getPriorityColor("high", darkMode)
          }}></div>
          <span style={{ color: darkMode ? "#ffffff" : "#1a4a52", fontSize: "14px" }}>High Priority</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "16px",
            height: "16px",
            borderRadius: "4px",
            background: getPriorityColor("medium", darkMode)
          }}></div>
          <span style={{ color: darkMode ? "#ffffff" : "#1a4a52", fontSize: "14px" }}>Medium Priority</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "16px",
            height: "16px",
            borderRadius: "4px",
            background: getPriorityColor("low", darkMode)
          }}></div>
          <span style={{ color: darkMode ? "#ffffff" : "#1a4a52", fontSize: "14px" }}>Low Priority</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "16px",
            height: "16px",
            borderRadius: "4px",
            background: darkMode ? "#555" : "#ccc"
          }}></div>
          <span style={{ color: darkMode ? "#ffffff" : "#1a4a52", fontSize: "14px" }}>Completed</span>
        </div>
      </div>
    </div>
  );
}
