# AI-Powered Consultant Evaluation Platform

An elite, AI-driven assessment engine designed to evaluate management consultants through high-fidelity, live case study interviews. The platform automates the end-to-end recruitment funnel—from case creation via PDF parsing to real-time conversational evaluation using advanced Large Language Models.

> "Scaling elite talent identification through sovereign AI intelligence."

---

## System Architecture & Flow

### 1. High-Level Architecture (C4 Model)
The platform is built on a decoupled architecture ensuring separation of concerns between candidate experience, administrative management, and AI intelligence.

```mermaid
graph TB
    subgraph Client Layer
        Admin[Admin Dashboard - React]
        Cand[Candidate Assessment Portal - React]
    end

    subgraph Logic Layer
        Express[Express.js Server]
        Auth[Auth & Permission Logic]
        PDF[PDF Parsing Engine]
        AI_Eng[AI Evaluation Engine]
    end

    subgraph Intelligence & Data Layer
        Groq[Groq Llama 3 API]
        Supabase[Supabase PostgreSQL]
        Rotation[High-Availability Key Rotation]
    end

    Admin --> Express
    Cand --> Express
    Express --> Auth
    Express --> PDF
    Express --> AI_Eng
    AI_Eng --> Rotation
    Rotation --> Groq
    Express --> Supabase
```

---

### 2. AI Interview & Evaluation Logic
The core of the platform is a sophisticated evaluation loop that handles candidate input, assesses logic depth, and manages session state (including disqualifications).

```mermaid
flowchart TD
    Start([Candidate Answer Received]) --> Valid{Valid Input?}
    Valid -- No --> Retry[Prompt for Input]
    Valid -- Yes --> Engine{AI Available?}
    
    Engine -- Yes --> LLM[Llama 3 70B Evaluation]
    Engine -- No --> Rules[Rule-Based Fallback Engine]
    
    LLM --> Metrics[Extract Rubric Scores]
    Rules --> Metrics
    
    Metrics --> Depth{Logical Depth > 2?}
    Depth -- No --> Strike[Increment Strike Count]
    Depth -- Yes --> Next[Update Session State]
    
    Strike --> Max{Strikes >= 3?}
    Max -- Yes --> Disq([DISQUALIFIED])
    Max -- No --> Next
    
    Next --> Phase{Next Phase?}
    Phase -- Partial --> Question[Generate Dynamic Question]
    Phase -- Complete --> Results([GENERATE FINAL SCORE])
    
    Question --> FE[Display to Candidate]
```

---

### 3. PDF Data Extraction Pipeline
Admins can upload case PDFs which are processed through a multi-stage extraction pipeline to build structured interactive assessments.

```mermaid
flowchart LR
    PDF[Raw PDF Upload] --> Clean[Text Cleaning & Normalization]
    Clean --> Regex[Pattern Matching Extraction]
    
    subgraph Extraction Stages
        Regex --> Title[Title & Industry Inference]
        Regex --> Context[Context & Problem Extraction]
        Regex --> Series[Numeric Time-Series Parsing]
        Regex --> Logic[Scoring Logic & Rubrics]
    end
    
    Title --> JSON[Final Case JSON Draft]
    Context --> JSON
    Series --> JSON
    Logic --> JSON
    
    JSON --> DB[(Database Storage)]
```

---

### 4. High-Availability (HA) AI Failover
To prevent interview interruption, the platform implements a round-robin rotation for AI API keys.

```mermaid
sequenceDiagram
    participant App as Backend Engine
    participant K1 as Groq Key #1
    participant K2 as Groq Key #2 (Failover)
    
    App->>K1: Send Evaluation Request
    alt Key #1 Success
        K1-->>App: Return JSON Scoring
    else Key #1 Limit/Error
        K1-->>App: 429 / 500 Error
        Note over App, K2: [HA-FAILOVER] Switch to Key #2
        App->>K2: Retry Evaluation Request
        K2-->>App: Return JSON Scoring
    end
```

---

## Core Capabilities

### AI Interview Engine
*   **Live Conversational Assessment**: Conducts real-time, multi-step interviews using **Llama 3.3 (70B)** via Groq.
*   **Adaptive Follow-ups**: The AI dynamically generates probing questions based on candidate responses.
*   **Phase-Based Logic**: Interviews proceed through logical consulting phases: `Diagnostic`, `Brainstorming`, `Calculations`, and `Recommendation`.

### Intelligent Case Management
*   **PDF-to-Case Parser**: Automatically transforms standard consulting case PDFs into structured assessments.
*   **Domain Agnostic**: Supports diverse industries including **FinTech**, **SaaS**, **D2C**, and **Banking**.

### Comprehensive Evaluation & Scoring
*   **5-Metric Rubric**: Candidates are scored on Problem Understanding, Data Usage, Root Cause Identification, Solution Quality, and Consistency.
*   **Strike System**: Automated disqualification for generic or low-depth responses (3-strike limit).

---

## Tech Stack
*   **Frontend**: React.js, Vite, Vanilla CSS.
*   **Backend**: Node.js, Express.
*   **AI/LLM**: Groq SDK (Llama 3.3 70B Versatile).
*   **Database**: Supabase (PostgreSQL).
*   **Storage**: Multer (In-memory buffer).

---

## Installation & Setup

### 1. Environment Configuration
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GROQ_API_KEY_1=your_primary_groq_key
GROQ_API_KEY_2=your_backup_groq_key
```

### 2. Database Setup
Execute the SQL found in [`backend/schema_v2_evaluation.sql`](file:///backend/schema_v2_evaluation.sql) inside your Supabase SQL Editor.

### 3. Unified Development Launch
```bash
npm run install-all
npm start
```