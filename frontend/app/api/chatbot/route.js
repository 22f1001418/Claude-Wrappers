import { NextResponse } from "next/server";

const BACKEND_CANDIDATES = [
  process.env.BACKEND_URL,
  "http://127.0.0.1:5001",
  "http://localhost:5001",
  "http://192.168.1.9:5001",
].filter(Boolean);

export async function POST(request) {
  try {
    const { question } = await request.json();

    if (!question) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    // Auto-detect active backend (server-side: no CORS restriction, just try each URL)
    let backendUrl = BACKEND_CANDIDATES[0];
    for (const url of BACKEND_CANDIDATES) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 1500);
        const probe = await fetch(`${url}/health`, { method: 'HEAD', signal: ctrl.signal });
        clearTimeout(t);
        if (probe.ok) { backendUrl = url; break; }
      } catch { /* unreachable, try next */ }
    }
    const response = await fetch(`${backendUrl}/api/chatbot/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Backend error: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json({ answer: data.answer });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { 
        error: "Failed to get response from VyaparAI assistant", 
        answer: "Sorry, I'm having trouble connecting right now. Please make sure the backend server is running on port 5001." 
      },
      { status: 500 }
    );
  }
}
