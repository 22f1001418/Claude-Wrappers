"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardNavbar from "@/app/components/Navbar";
import DashboardSidebar from "@/app/components/Sidebar";
import styles from "@/styles/notes.module.css";
import { fetchWithAuth } from "@/lib/auth";
import { useSyncedTheme } from "@/lib/theme";

export default function Notes() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { darkMode, toggleTheme } = useSyncedTheme();
  const [notes, setNotes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [isNewNote, setIsNewNote] = useState(true);
  const [selectedNote, setSelectedNote] = useState(null);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      
      // Check if user role is owner or user
      if (userData.role !== "owner" && userData.role !== "user") {
        router.replace("/dashboard");
        return;
      }
    } else {
      router.replace("/login");
    }

    setLoading(false);
  }, [router]);

  // Fetch notes
  useEffect(() => {
    if (user) {
      fetchNotes();
    }
  }, [user]);

  const fetchNotes = async () => {
    try {
      const response = await fetchWithAuth("http://localhost:5001/api/notes", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setNotes(data.notes);
        }
      }
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
  };

  const handleProfileClick = () => {
    router.push("/profile");
  };

  const handleAddNote = () => {
    setIsNewNote(true);
    setSelectedNote(null);
    setIsModalOpen(true);
    setNoteText("");
  };

  const handleViewNote = (note) => {
    setIsNewNote(false);
    setSelectedNote(note);
    setNoteText(note.text);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setNoteText("");
    setSelectedNote(null);
    setIsNewNote(true);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) {
      alert("Please write something in the note!");
      return;
    }

    if (!isNewNote) {
      // Notes are not editable, this shouldn't happen
      return;
    }

    setSavingNote(true);

    try {
      const response = await fetchWithAuth("http://localhost:5001/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: noteText
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Add new note to the beginning of the array
          setNotes([data.note, ...notes]);
          handleCloseModal();
        } else {
          alert("Failed to save note");
        }
      } else {
        alert("Failed to save note");
      }
    } catch (error) {
      console.error("Error saving note:", error);
      alert("Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm("Are you sure you want to delete this note?")) {
      return;
    }

    try {
      const response = await fetchWithAuth(`http://localhost:5001/api/notes/${noteId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Remove note from array
          setNotes(notes.filter(note => note.note_id !== noteId));
          handleCloseModal();
        } else {
          alert("Failed to delete note");
        }
      } else {
        alert("Failed to delete note");
      }
    } catch (error) {
      console.error("Error deleting note:", error);
      alert("Failed to delete note");
    }
  };

  const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString);
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleString('en-US', options);
  };

  if (loading) {
    return (
      <div style={{ 
        height: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: darkMode ? '#0a0a0a' : '#faf8f5'
      }}>
        <div style={{ 
          color: darkMode ? '#ffffff' : '#1a4a52',
          fontSize: "18px"
        }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.notesContainer}>
      <DashboardNavbar
        darkMode={darkMode}
        toggleTheme={toggleTheme}
        handleProfileClick={handleProfileClick}
        user={user}
      />
      <DashboardSidebar darkMode={darkMode} user={user} />

      <div className={styles.mainContent}>
        <div className={styles.header}>
          <h1 className={styles.title}>My Notes</h1>
          <button 
            className={styles.addButton}
            onClick={handleAddNote}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Note
          </button>
        </div>

        <div className={styles.notesGrid}>
          {notes.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
              <p>No notes yet. Click &quot;Add Note&quot; to create your first note!</p>
            </div>
          ) : (
            notes.map(note => (
              <div 
                key={note.note_id} 
                className={styles.noteCard}
                onClick={() => handleViewNote(note)}
              >
                <div className={styles.noteFold}></div>
                <div className={styles.noteContent}>
                  <p className={styles.noteText}>
                    {note.text.length > 150 ? `${note.text.substring(0, 150)}...` : note.text}
                  </p>
                  <div className={styles.noteFooter}>
                    <span className={styles.noteDate}>{formatDateTime(note.created_at)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalFold}></div>
            <button 
              className={styles.closeButton}
              onClick={handleCloseModal}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <h2 className={styles.modalTitle}>{isNewNote ? "New Note" : "View Note"}</h2>
            
            {isNewNote ? (
              <>
                <textarea
                  className={styles.noteInput}
                  placeholder="Write your note here..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  autoFocus
                />
                <button 
                  className={styles.saveButton}
                  onClick={handleSaveNote}
                  disabled={savingNote}
                >
                  {savingNote ? "Saving..." : "Save Note"}
                </button>
              </>
            ) : (
              <>
                <div className={styles.noteViewContent}>
                  {noteText}
                </div>
                <div className={styles.noteViewFooter}>
                  <span className={styles.noteViewDate}>
                    Created: {formatDateTime(selectedNote.created_at)}
                  </span>
                </div>
                <button 
                  className={styles.deleteButtonModal}
                  onClick={() => handleDeleteNote(selectedNote.note_id)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                  Delete Note
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
