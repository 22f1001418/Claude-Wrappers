"""
VyaपारAI RAG System
RAG (Retrieval-Augmented Generation) system using LangGraph and OpenRouter
"""

import os
from dotenv import load_dotenv

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain_community.vectorstores import FAISS

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_openai import ChatOpenAI

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from langgraph.graph import StateGraph, END
from typing import TypedDict

# Get the base directory (backend folder)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Load .env from project root
load_dotenv(dotenv_path=os.path.join(BASE_DIR, "..", ".env"))

print(f"✅ BASE_DIR: {BASE_DIR}")
print(f"✅ .env path: {os.path.join(BASE_DIR, '..', '.env')}")

# ==============================
# EMBEDDINGS + VECTOR STORE
# ==============================

google_api_key = os.getenv("GOOGLE_API_KEY")
if not google_api_key:
    print("❌ ERROR: GOOGLE_API_KEY not found in .env file!")
    raise ValueError("GOOGLE_API_KEY environment variable is not set")

print(f"✅ GOOGLE_API_KEY found")

embeddings = GoogleGenerativeAIEmbeddings(
    model="gemini-embedding-001"
)
print(f"✅ Embeddings initialized successfully")

# Define paths relative to backend folder
KNOWLEDGE_FILE = os.path.join(BASE_DIR, "chatbot", "knowledge", "vyaparai_knowledge.md")
FAISS_DB_PATH = os.path.join(BASE_DIR, "chatbot", "vectorstore")

print(f"✅ KNOWLEDGE_FILE: {KNOWLEDGE_FILE}")
print(f"✅ FAISS_DB_PATH: {FAISS_DB_PATH}")
print(f"✅ Knowledge file exists: {os.path.exists(KNOWLEDGE_FILE)}")
print(f"✅ FAISS DB path exists: {os.path.exists(FAISS_DB_PATH)}")

# Check if FAISS database exists
if os.path.exists(FAISS_DB_PATH):
    print("📂 Loading existing FAISS database...")
    try:
        vectorstore = FAISS.load_local(
            FAISS_DB_PATH, 
            embeddings, 
            allow_dangerous_deserialization=True
        )
        print("✅ FAISS database loaded successfully!")
    except Exception as e:
        print(f"❌ Error loading FAISS database: {e}")
        print("🔄 Will recreate FAISS database...")
        vectorstore = None
else:
    print("📂 FAISS database not found. Creating new embeddings...")
    vectorstore = None

if vectorstore is None:
    try:
        # Load and split documents
        if not os.path.exists(KNOWLEDGE_FILE):
            raise FileNotFoundError(f"Knowledge file not found at {KNOWLEDGE_FILE}")
        
        print(f"📄 Loading knowledge file from {KNOWLEDGE_FILE}")
        loader = TextLoader(KNOWLEDGE_FILE, encoding="utf-8")
        documents = loader.load()
        print(f"✅ Loaded {len(documents)} document(s)")
        
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=150
        )
        
        docs = splitter.split_documents(documents)
        print(f"✅ Split into {len(docs)} chunks")
        
        # Create vectorstore
        print("🔄 Creating FAISS vectorstore...")
        vectorstore = FAISS.from_documents(docs, embeddings)
        print("✅ FAISS vectorstore created successfully")
        
        # Save vectorstore for future use
        os.makedirs(FAISS_DB_PATH, exist_ok=True)
        vectorstore.save_local(FAISS_DB_PATH)
        print(f"✅ FAISS database saved to {FAISS_DB_PATH}!")
    except Exception as e:
        print(f"❌ FATAL ERROR creating FAISS database: {e}")
        import traceback
        traceback.print_exc()
        raise

retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

# ==============================
# OPENROUTER LLM (via OpenAI-compatible API)
# ==============================

llm = ChatOpenAI(
    model="meta-llama/llama-3.1-8b-instruct",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0.2
)

# ==============================
# PROMPT (STRICT RAG)
# ==============================

# System prompt - rigid instructions
system_prompt = """You are VyaparAI assistant, a highly specialized knowledge base assistant.

CRITICAL RULES YOU MUST FOLLOW:
1. You can greet the user and introduce yourself, but you MUST NOT provide any information about your architecture, training data, or capabilities that is not explicitly stated in the provided context.
2. You MUST answer ONLY using information explicitly stated in the provided context below.
3. You are STRICTLY FORBIDDEN from using any external knowledge, assumptions, or information not present in the context.
4. If the answer to the user's question is NOT found in the context, you MUST respond with EXACTLY this message:
   "I apologize, but I cannot answer this question as the information is not available in the VyaparAI knowledge base. Please contact support for assistance."
5. Do NOT attempt to infer, guess, or provide partial answers if the full answer is not in the context.
6. Do NOT provide general knowledge or advice that is not explicitly stated in the context.

Your sole purpose is to retrieve and relay information from the VyaparAI knowledge base, nothing more."""

# Human prompt template with context and question
prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    ("human", """Context from VyaparAI knowledge base:
{context}

User Question:
{question}

Please answer the question using ONLY the context provided above. If the answer is not in the context, respond with the apology message.""")
])

parser = StrOutputParser()

# ==============================
# GRAPH STATE
# ==============================

class GraphState(TypedDict):
    question: str
    context: str
    answer: str

# ==============================
# RETRIEVER NODE
# ==============================

def retrieve_node(state: GraphState):
    """Retrieve relevant documents from vectorstore"""
    question = state["question"]

    retrieved_docs = retriever.invoke(question)
    context = "\n\n".join([doc.page_content for doc in retrieved_docs])

    return {"context": context}

# ==============================
# GENERATION NODE
# ==============================

def generate_node(state: GraphState):
    """Generate answer using LLM"""
    question = state["question"]
    context = state["context"]

    chain = prompt | llm | parser

    answer = chain.invoke({
        "question": question,
        "context": context
    })

    return {"answer": answer}

# ==============================
# BUILD LANGGRAPH
# ==============================

workflow = StateGraph(GraphState)

workflow.add_node("retrieve", retrieve_node)
workflow.add_node("generate", generate_node)

workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)

graph = workflow.compile()

# ==============================
# CHAT FUNCTION (API USE)
# ==============================

def ask_vyaparai(question: str) -> str:
    """
    Ask a question to the VyaपारAI assistant
    
    Args:
        question: User's question
        
    Returns:
        str: AI-generated answer
    """
    result = graph.invoke({
        "question": question
    })
    return result["answer"]

# ==============================
# LOCAL TEST
# ==============================

if __name__ == "__main__":
    print("🤖 VyaपारAI Assistant - Interactive Mode")
    print("Type 'exit' or 'quit' to stop\n")
    
    while True:
        q = input("\n💬 Ask: ")
        if q.lower() in ['exit', 'quit', 'q']:
            print("👋 Goodbye!")
            break
        
        if q.strip():
            print("\n🤖 Bot:", ask_vyaparai(q))
