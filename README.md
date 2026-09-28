# AthenaLib - AI-Powered Library Management System 📚⚡

AthenaLib is a next-generation intelligent Library Management System built with a Node.js Express backend, a modern glassmorphic responsive dashboard, a resilient dual-engine database architecture (supporting **MySQL 8.0** and instant zero-config embedded persistence), and an integrated **AI Intelligence Hub ("Athena AI")**.

---

## 🌟 Key Features

### 1. 📊 Intelligence Dashboard
- **Real-Time KPIs**: Total titles, total inventory copies, copies currently on loan, overdue loans alert, registered members, and collected fines.
- **Visual Analytics**: Interactive category distribution breakdown, top 5 most borrowed books leaderboard, and live activity audit log.
- **System DB Indicator**: Live status badge displaying active database mode (MySQL or Embedded).

### 2. 📚 Book Catalog Management
- **Instant Search & Multi-Filtering**: Real-time search across titles, authors, ISBNs, tags, and categories. Filter by availability (In Stock vs Out of Stock) and sort by rating, publication year, or alphabetical order.
- **View Modes**: Switch between **Modern Cover Card Grid** (with 3D hover effects, rating chips, and animated stock progress bars) and **Compact Table View**.
- **AI Auto-Fill Assistant**: Enter just the title and author, then click **AI Auto-Fill** to automatically generate category classification, thematic tags, and a publication synopsis!
- **Book Details & AI Dossier**: Inspect inventory status, full loan history, and launch one-click checkout or AI deep summary.

### 3. 🔄 Circulation & Automated Loan Tracking
- **Issue / Checkout**: Choose available books and registered members with auto-calculated due dates (7, 14, 21, or 30 days) and instant inventory stock decrement.
- **Return & Fine Settlement**: Auto-calculates overdue days and late fees at **$0.50/day**, with options to waive or collect fines and automatically restock copies.
- **Renewals**: 1-click renewal extends due dates by 7 days.
- **Active Loans Table**: Color-coded badges (`Active`, `Due Soon`, `Overdue`) with instant action triggers.
- **Circulation History**: Complete audit record of all past and present checkout events.

### 4. 👥 Member Registry
- **Membership Tiers**: Student (5 books max), Faculty (10 books max), Scholar (8 books max), and Premium (12 books max).
- **Profile Metrics**: Live tracking of current active loans, historical loans count, and unpaid fine balances.
- **Member Management**: Register new patrons, edit tiers/contact details, and verify borrowing privileges.

### 5. 🤖 Athena AI Intelligence Hub
- **Semantic Natural Language Search**: Find books using abstract concepts, philosophical questions, or analogies (e.g., *"thought-provoking sci-fi dealing with artificial general intelligence and simulation theory"*).
- **AI Book Summarizer & Insights**: Generates 3 core takeaways, target audience recommendations, reading difficulty ratings, and estimated reading time.
- **Personalized Recommendation Matrix**: Suggests books based on member loan history, category affinity, and critical acclaim.
- **Athena Conversational Librarian**: Floating 24/7 chatbot with live catalog awareness, policy explanation, and book discovery assistance.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18 or higher installed; Node 24 supported)
- npm

### 1. Start the Server
Open PowerShell or your terminal and run:
```powershell
# From the project folder:
cd "d:\project sss\AI-Powered-Library-Management-System"
npm start
```
*Alternatively, you can run `node server.js` from `d:\project sss`.*

### 2. Access the Application
Open your browser and navigate to:
```
http://localhost:5000
```
- **Dashboard UI**: `http://localhost:5000`
- **API Health Check**: `http://localhost:5000/api/health`

---

## 🗄️ Database Configuration (Resilient Dual-Engine)

AthenaLib is engineered to **never fail on database startup**:

1. **Embedded Zero-Config Mode (Default Out-of-the-Box)**:
   - If MySQL credentials are not supplied, the system immediately initializes a high-performance JSON store in `data/library_store.json`.
   - Pre-seeded with 15 rich books, 5 members, and realistic circulation records so you can test everything right away.

2. **MySQL 8.0 Integration**:
   - To connect to your local MySQL server (detected as `MySQL80` on your machine):
   - Open `.env` in `AI-Powered-Library-Management-System/`:
     ```env
     DB_HOST=localhost
     DB_PORT=3306
     DB_USER=root
     DB_PASSWORD=your_mysql_password
     DB_NAME=library_db
     ```
   - Restart the server (`npm start`). AthenaLib will automatically connect, create the `library_db` database, execute all table migrations, and seed initial records!

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/books` | Get books with search, filter, and sorting |
| `GET` | `/api/books/:id` | Get book details and recent loan history |
| `POST` | `/api/books` | Add new book to catalog |
| `PUT` | `/api/books/:id` | Update book information and stock |
| `DELETE` | `/api/books/:id` | Remove book (checks for active loans) |
| `GET` | `/api/members` | Get all members with active loan counts |
| `POST` | `/api/members` | Register a new member |
| `GET` | `/api/transactions/active` | Get all currently issued loans |
| `POST` | `/api/transactions/issue` | Issue book to member (decrements stock) |
| `POST` | `/api/transactions/return` | Check in book & calculate overdue fines |
| `POST` | `/api/transactions/renew/:id`| Extend due date by 7 days |
| `GET` | `/api/analytics/dashboard` | Get KPIs, category distribution, & trends |
| `POST` | `/api/ai/semantic-search` | NLP semantic book search & scoring |
| `POST` | `/api/ai/summarize` | AI book synopsis & reading takeaways |
| `POST` | `/api/ai/recommend` | Personalized recommendation matrix |
| `POST` | `/api/ai/chat` | Conversational Athena AI Assistant |
| `POST` | `/api/ai/auto-catalog` | AI metadata generator for new titles |

---

## 🎨 Design System
- **Theme**: Sleek Dark Mode (default) with smooth toggle to Light Mode.
- **Typography**: Google Fonts (*Outfit* for bold headings, *Plus Jakarta Sans* for clean body text).
- **Palette**: HSL Neon Indigo (`#6366f1`), Electric Violet (`#8b5cf6`), Emerald Green (`#10b981`), Amber (`#f59e0b`), Rose (`#ef4444`).
- **Glassmorphism**: Soft backdrop blur (`backdrop-filter: blur(14px)`), translucent cards, glowing elevation drop shadows.
