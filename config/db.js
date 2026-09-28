const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

let pool = null;
let currentEngine = "uninitialized";
const dataDir = path.join(__dirname, "..", "data");
const dbFilePath = path.join(dataDir, "library_store.json");

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Embedded Fallback Store Definition
class EmbeddedStore {
    constructor(filePath) {
        this.filePath = filePath;
        this.data = {
            books: [],
            members: [],
            transactions: [],
            ai_logs: [],
            users: []
        };
        this.counters = {
            books: 1,
            members: 1,
            transactions: 1,
            ai_logs: 1,
            users: 1
        };
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, "utf-8");
                const parsed = JSON.parse(raw);
                this.data = {
                    books: [],
                    members: [],
                    transactions: [],
                    ai_logs: [],
                    users: [],
                    ...(parsed.data || {})
                };
                this.counters = {
                    books: 1,
                    members: 1,
                    transactions: 1,
                    ai_logs: 1,
                    users: 1,
                    ...(parsed.counters || {})
                };
            } else {
                this.save();
            }
        } catch (err) {
            console.error("[Embedded DB] Error reading data file:", err.message);
        }
    }

    save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify({
                data: this.data,
                counters: this.counters
            }, null, 2), "utf-8");
        } catch (err) {
            console.error("[Embedded DB] Error saving data file:", err.message);
        }
    }

    query(sql, params = []) {
        const trimmed = sql.trim();
        const upper = trimmed.toUpperCase();

        // 1. INSERT
        if (upper.startsWith("INSERT INTO")) {
            const match = trimmed.match(/INSERT\s+INTO\s+([a-zA-Z_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
            if (match) {
                const table = match[1].toLowerCase();
                const cols = match[2].split(",").map(c => c.trim());
                if (!this.data[table]) this.data[table] = [];

                const newId = this.counters[table] ? this.counters[table]++ : (this.data[table].length + 1);
                this.counters[table] = newId + 1;

                const newRow = { id: newId };
                cols.forEach((col, idx) => {
                    newRow[col] = params[idx] !== undefined ? params[idx] : null;
                });
                newRow.created_at = new Date().toISOString();
                newRow.updated_at = new Date().toISOString();

                this.data[table].push(newRow);
                this.save();

                return Promise.resolve([{ insertId: newId, affectedRows: 1 }, null]);
            }
        }

        // 2. UPDATE
        if (upper.startsWith("UPDATE")) {
            const tableMatch = trimmed.match(/UPDATE\s+([a-zA-Z_]+)/i);
            const table = tableMatch ? tableMatch[1].toLowerCase() : null;

            if (table && this.data[table]) {
                let id = null;
                const whereMatch = trimmed.match(/WHERE\s+id\s*=\s*\?/i);
                if (whereMatch) {
                    id = Number(params[params.length - 1]);
                }

                const item = this.data[table].find(r => Number(r.id) === id);
                if (item) {
                    // Parse SET columns
                    const setPartMatch = trimmed.match(/SET\s+([\s\S]+?)\s+WHERE/i);
                    if (setPartMatch) {
                        const setStr = setPartMatch[1];
                        const setClauses = setStr.split(",").map(s => s.trim());
                        let paramIdx = 0;
                        setClauses.forEach(clause => {
                            const [colName] = clause.split("=").map(s => s.trim());
                            if (colName) {
                                item[colName] = params[paramIdx++];
                            }
                        });
                    }
                    item.updated_at = new Date().toISOString();
                    this.save();
                    return Promise.resolve([{ affectedRows: 1 }, null]);
                }
                return Promise.resolve([{ affectedRows: 0 }, null]);
            }
        }

        // 3. DELETE
        if (upper.startsWith("DELETE FROM")) {
            const tableMatch = trimmed.match(/DELETE\s+FROM\s+([a-zA-Z_]+)\s+WHERE\s+id\s*=\s*\?/i);
            if (tableMatch) {
                const table = tableMatch[1].toLowerCase();
                const id = Number(params[0]);
                const beforeLen = this.data[table] ? this.data[table].length : 0;
                if (this.data[table]) {
                    this.data[table] = this.data[table].filter(r => Number(r.id) !== id);
                }
                const affectedRows = beforeLen - (this.data[table] ? this.data[table].length : 0);
                this.save();
                return Promise.resolve([{ affectedRows }, null]);
            }
        }

        // 4. SELECT
        if (upper.startsWith("SELECT")) {
            // Check for transaction JOIN query
            if (upper.includes("FROM TRANSACTIONS") && upper.includes("JOIN BOOKS")) {
                let rows = this.data.transactions.map(t => {
                    const book = this.data.books.find(b => Number(b.id) === Number(t.book_id)) || {};
                    const member = this.data.members.find(m => Number(m.id) === Number(t.member_id)) || {};
                    return {
                        ...t,
                        book_title: book.title || "Unknown Book",
                        book_author: book.author || "",
                        book_isbn: book.isbn || "",
                        member_name: member.name || "Unknown Member",
                        member_code: member.member_code || "",
                        member_email: member.email || ""
                    };
                });

                if (upper.includes("WHERE T.STATUS = ?")) {
                    rows = rows.filter(r => r.status === params[0]);
                } else if (upper.includes("WHERE T.MEMBER_ID = ?")) {
                    rows = rows.filter(r => Number(r.member_id) === Number(params[0]));
                } else if (upper.includes("WHERE T.BOOK_ID = ?")) {
                    rows = rows.filter(r => Number(r.book_id) === Number(params[0]));
                }

                // Sorting
                if (upper.includes("ORDER BY T.ID DESC")) {
                    rows.sort((a, b) => Number(b.id) - Number(a.id));
                }

                return Promise.resolve([rows, null]);
            }

            // Normal table SELECT
            let table = "books";
            if (upper.includes("FROM MEMBERS")) table = "members";
            else if (upper.includes("FROM TRANSACTIONS")) table = "transactions";
            else if (upper.includes("FROM AI_LOGS")) table = "ai_logs";
            else if (upper.includes("FROM USERS")) table = "users";
            else if (upper.includes("FROM BOOKS")) table = "books";

            let rows = [...(this.data[table] || [])];

            // WHERE id = ?
            if (upper.includes("WHERE ID = ?")) {
                const id = Number(params[0]);
                rows = rows.filter(r => Number(r.id) === id);
            } else if (upper.includes("WHERE MEMBER_CODE = ?")) {
                rows = rows.filter(r => r.member_code === params[0]);
            } else if (upper.includes("WHERE EMAIL = ?")) {
                const searchEmail = (params[0] || "").toLowerCase().trim();
                rows = rows.filter(r => r.email && r.email.toLowerCase().trim() === searchEmail);
            } else if (upper.includes("WHERE MEMBER_ID = ?")) {
                rows = rows.filter(r => Number(r.member_id) === Number(params[0]));
            } else if (upper.includes("WHERE STATUS = ?")) {
                rows = rows.filter(r => r.status === params[0]);
            } else if (upper.includes("WHERE CATEGORY = ?")) {
                rows = rows.filter(r => r.category && r.category.toLowerCase() === (params[0] || "").toLowerCase());
            }

            // ORDER BY
            if (upper.includes("ORDER BY ID DESC")) {
                rows.sort((a, b) => Number(b.id) - Number(a.id));
            } else if (upper.includes("ORDER BY RATING DESC")) {
                rows.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
            }

            // LIMIT
            const limitMatch = trimmed.match(/LIMIT\s+(\d+)/i);
            if (limitMatch) {
                const limit = parseInt(limitMatch[1], 10);
                rows = rows.slice(0, limit);
            }

            return Promise.resolve([rows, null]);
        }

        return Promise.resolve([[], null]);
    }
}

const embeddedStore = new EmbeddedStore(dbFilePath);

async function initDB() {
    const host = process.env.DB_HOST || "localhost";
    const user = process.env.DB_USER || "root";
    const password = process.env.DB_PASSWORD || "";
    const database = process.env.DB_NAME || "library_db";
    const port = process.env.DB_PORT || 3306;

    // Test MySQL connection first
    try {
        const conn = await mysql.createConnection({
            host,
            user,
            password,
            port,
            connectTimeout: 2000
        });

        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
        await conn.end();

        pool = mysql.createPool({
            host,
            user,
            password,
            database,
            port,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Initialize tables in MySQL
        const schemaFile = path.join(__dirname, "schema.sql");
        if (fs.existsSync(schemaFile)) {
            const schemaSql = fs.readFileSync(schemaFile, "utf-8");
            const statements = schemaSql
                .split(";")
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith("--") && !s.toUpperCase().startsWith("CREATE DATABASE") && !s.toUpperCase().startsWith("USE"));

            for (const stmt of statements) {
                await pool.query(stmt);
            }
        }

        currentEngine = "mysql";
        console.log(`[Database] Successfully connected to MySQL (${database})`);
        return;
    } catch (err) {
        console.warn(`[Database] MySQL not available (${err.message}). Using Embedded Resilient DB Engine.`);
        currentEngine = "embedded";
    }
}

// Uniform Query Interface
async function query(sql, params = []) {
    if (currentEngine === "uninitialized") {
        await initDB();
    }

    if (currentEngine === "mysql" && pool) {
        try {
            return await pool.query(sql, params);
        } catch (err) {
            console.error("[Database MySQL Error]", err.message);
            throw err;
        }
    }

    return embeddedStore.query(sql, params);
}

function getEngine() {
    return {
        engine: currentEngine,
        status: "active",
        file: currentEngine === "embedded" ? dbFilePath : null
    };
}

module.exports = {
    query,
    initDB,
    getEngine,
    embeddedStore
};

// If run directly (e.g. via VS Code Run Code)
if (require.main === module) {
    (async () => {
        console.log("==========================================");
        console.log("🔍 AthenaLib Database Diagnostic Check");
        console.log("==========================================");
        await initDB();
        const engine = getEngine();
        console.log(`✅ Active DB Engine: ${engine.engine.toUpperCase()}`);
        if (engine.file) console.log(`📁 Store File: ${engine.file}`);
        const [books] = await query("SELECT * FROM books");
        const [members] = await query("SELECT * FROM members");
        console.log(`📚 Total Books in DB: ${books ? books.length : 0}`);
        console.log(`👥 Total Members in DB: ${members ? members.length : 0}`);
        console.log("------------------------------------------");
        console.log("🚀 To start the full web application, run:");
        console.log("   npm start   OR   node server.js");
        console.log("   Then open: http://localhost:5000");
        console.log("==========================================");
        process.exit(0);
    })();
}

