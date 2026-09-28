/**
 * AthenaLib - AI-Powered Library Management System
 * Core Client Application Controller
 */

class LibraryApp {
    constructor() {
        let savedUser = null;
        try {
            savedUser = JSON.parse(localStorage.getItem("athena_user"));
        } catch (e) {
            savedUser = null;
        }

        this.state = {
            books: [],
            members: [],
            activeLoans: [],
            allTransactions: [],
            dashboard: null,
            currentUser: savedUser,
            authToken: localStorage.getItem("athena_token") || null,
            currentView: "dashboard",
            currentSubTab: "active-loans",
            currentAccountTab: "loans",
            viewMode: "grid", // 'grid' | 'table'
            theme: localStorage.getItem("athena_theme") || "dark"
        };

        this.init();
    }

    async init() {
        this.applyTheme(this.state.theme);
        this.bindEvents();
        this.bindAuthEvents();
        this.updateAuthUI();
        this.initRouting();
        await this.loadInitialData();
        if (this.state.authToken) {
            this.verifySession();
        }
    }

    // ----------------------------------------------------
    // INITIALIZATION & EVENT BINDINGS
    // ----------------------------------------------------
    bindEvents() {
        // Theme Toggle
        const themeBtn = document.getElementById("theme-toggle-btn");
        if (themeBtn) {
            themeBtn.addEventListener("click", () => this.toggleTheme());
        }

        // Navigation Items
        document.querySelectorAll(".nav-item").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const view = btn.getAttribute("data-view");
                this.switchView(view);
            });
        });

        // Mobile Sidebar Toggle
        const mobileBtn = document.getElementById("mobile-toggle-btn");
        const sidebar = document.getElementById("sidebar");
        if (mobileBtn && sidebar) {
            mobileBtn.addEventListener("click", () => sidebar.classList.toggle("open"));
        }

        // Global Search Bar
        const globalSearch = document.getElementById("global-search-input");
        if (globalSearch) {
            globalSearch.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && globalSearch.value.trim()) {
                    const query = globalSearch.value.trim();
                    this.switchView("catalog");
                    const catalogSearch = document.getElementById("catalog-search");
                    if (catalogSearch) {
                        catalogSearch.value = query;
                        this.filterCatalog();
                    }
                }
            });
        }

        // Keyboard Shortcut ⌘K / Ctrl+K
        document.addEventListener("keydown", (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                globalSearch?.focus();
            }
        });

        // Catalog Toolbar Filters
        document.getElementById("catalog-search")?.addEventListener("input", () => this.filterCatalog());
        document.getElementById("catalog-category-filter")?.addEventListener("change", () => this.filterCatalog());
        document.getElementById("catalog-stock-filter")?.addEventListener("change", () => this.filterCatalog());
        document.getElementById("catalog-sort")?.addEventListener("change", () => this.filterCatalog());

        // View Mode Switcher
        document.getElementById("btn-view-grid")?.addEventListener("click", () => this.setViewMode("grid"));
        document.getElementById("btn-view-table")?.addEventListener("click", () => this.setViewMode("table"));

        // Dashboard Buttons
        document.getElementById("btn-refresh-stats")?.addEventListener("click", () => this.fetchDashboard(true));
        document.getElementById("btn-quick-issue")?.addEventListener("click", () => {
            this.switchView("circulation");
            this.switchSubTab("issue-form");
        });

        // Circulation Sub-tabs
        document.querySelectorAll(".sub-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                const sub = tab.getAttribute("data-sub");
                this.switchSubTab(sub);
            });
        });

        // Quick Athena buttons
        document.getElementById("btn-quick-athena")?.addEventListener("click", () => this.toggleAthenaWidget(true));
        document.querySelectorAll(".quick-prompt-chips button").forEach(chip => {
            chip.addEventListener("click", () => {
                const q = chip.getAttribute("data-query");
                this.toggleAthenaWidget(true);
                this.sendAthenaMessage(q);
            });
        });

        // Forms & Modals
        this.bindModalsAndForms();

        // Athena AI Assistant Widget
        this.bindAthenaChat();
    }

    bindModalsAndForms() {
        // Book Modal
        const modalBook = document.getElementById("modal-book");
        const openAddBook = () => {
            document.getElementById("form-book")?.reset();
            document.getElementById("book-edit-id").value = "";
            document.getElementById("modal-book-title").textContent = "Add New Book to Catalog";
            modalBook?.classList.add("active");
        };

        document.getElementById("btn-open-add-book")?.addEventListener("click", openAddBook);
        document.getElementById("btn-catalog-add-book")?.addEventListener("click", openAddBook);
        document.getElementById("btn-close-book-modal")?.addEventListener("click", () => modalBook?.classList.remove("active"));
        document.getElementById("btn-cancel-book-modal")?.addEventListener("click", () => modalBook?.classList.remove("active"));

        // Book Form Submit
        document.getElementById("form-book")?.addEventListener("submit", (e) => this.handleSaveBook(e));

        // AI Auto-Fill Helper
        document.getElementById("btn-ai-autofill")?.addEventListener("click", () => this.handleAiAutoFill());

        // Member Modal
        const modalMember = document.getElementById("modal-member");
        document.getElementById("btn-open-add-member")?.addEventListener("click", () => {
            document.getElementById("form-member")?.reset();
            document.getElementById("member-edit-id").value = "";
            modalMember?.classList.add("active");
        });
        document.getElementById("btn-close-member-modal")?.addEventListener("click", () => modalMember?.classList.remove("active"));
        document.getElementById("btn-cancel-member-modal")?.addEventListener("click", () => modalMember?.classList.remove("active"));
        document.getElementById("form-member")?.addEventListener("submit", (e) => this.handleSaveMember(e));

        // Member Search Filter
        document.getElementById("member-search")?.addEventListener("input", () => this.filterMembers());
        document.getElementById("member-tier-filter")?.addEventListener("change", () => this.filterMembers());

        // Circulation Issue Form
        document.getElementById("form-issue-book")?.addEventListener("submit", (e) => this.handleIssueBook(e));

        // Circulation Return Form
        document.getElementById("return-loan-select")?.addEventListener("change", (e) => this.handleReturnLoanSelect(e));
        document.getElementById("form-return-book")?.addEventListener("submit", (e) => this.handleReturnBook(e));

        // Details Modal Close
        document.getElementById("btn-close-details-modal")?.addEventListener("click", () => {
            document.getElementById("modal-book-details")?.classList.remove("active");
        });

        // AI Hub Features
        document.getElementById("btn-run-semantic-search")?.addEventListener("click", () => this.handleSemanticSearch());
        document.getElementById("btn-run-summarizer")?.addEventListener("click", () => this.handleSummarizer());
        document.getElementById("btn-run-recommendations")?.addEventListener("click", () => this.handleRecommendations());

        // Re-seed DB in settings
        document.getElementById("btn-reseed-data")?.addEventListener("click", async () => {
            this.showToast("Re-seeding database...", "info");
            try {
                await this.loadInitialData();
                this.showToast("Database refreshed with sample data!", "success");
            } catch (err) {
                this.showToast("Error re-seeding data", "error");
            }
        });
    }

    bindAthenaChat() {
        const fab = document.getElementById("athena-fab");
        const windowEl = document.getElementById("athena-chat-window");
        const closeBtn = document.getElementById("btn-close-athena");
        const sendBtn = document.getElementById("btn-send-athena");
        const input = document.getElementById("athena-chat-input");

        fab?.addEventListener("click", () => this.toggleAthenaWidget());
        closeBtn?.addEventListener("click", () => windowEl?.classList.add("hidden"));

        const doSend = () => {
            const text = input.value.trim();
            if (text) {
                this.sendAthenaMessage(text);
                input.value = "";
            }
        };

        sendBtn?.addEventListener("click", doSend);
        input?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") doSend();
        });

        // Chips in chat window
        document.querySelectorAll(".athena-suggested-actions .chip-sm").forEach(chip => {
            chip.addEventListener("click", () => {
                const msg = chip.getAttribute("data-msg");
                this.sendAthenaMessage(msg);
            });
        });
    }

    toggleAthenaWidget(forceOpen = false) {
        const windowEl = document.getElementById("athena-chat-window");
        if (windowEl) {
            if (forceOpen) {
                windowEl.classList.remove("hidden");
            } else {
                windowEl.classList.toggle("hidden");
            }
            if (!windowEl.classList.contains("hidden")) {
                document.getElementById("athena-chat-input")?.focus();
            }
        }
    }

    applyTheme(theme) {
        this.state.theme = theme;
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("athena_theme", theme);
        const icon = document.querySelector(".theme-icon");
        if (icon) {
            icon.className = theme === "dark" ? "fa-solid fa-moon theme-icon" : "fa-solid fa-sun theme-icon";
        }
    }

    toggleTheme() {
        const next = this.state.theme === "dark" ? "light" : "dark";
        this.applyTheme(next);
    }

    initRouting() {
        const hash = window.location.hash.replace("#", "");
        if (hash && ["dashboard", "catalog", "circulation", "members", "ai-hub", "settings", "login", "my-account"].includes(hash)) {
            this.switchView(hash);
        } else {
            this.switchView("dashboard");
        }

        window.addEventListener("hashchange", () => {
            const newHash = window.location.hash.replace("#", "");
            if (newHash && newHash !== this.state.currentView) {
                this.switchView(newHash);
            }
        });
    }

    switchView(viewName) {
        this.state.currentView = viewName;
        window.location.hash = viewName;

        // Update nav buttons
        document.querySelectorAll(".nav-item").forEach(btn => {
            if (btn.getAttribute("data-view") === viewName) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        // Update view panels
        document.querySelectorAll(".view-panel").forEach(panel => {
            if (panel.id === `view-${viewName}`) {
                panel.classList.add("active");
            } else {
                panel.classList.remove("active");
            }
        });

        // Close mobile sidebar if open
        document.getElementById("sidebar")?.classList.remove("open");

        // Specific view updates
        if (viewName === "dashboard") this.fetchDashboard();
        if (viewName === "catalog") this.fetchBooks();
        if (viewName === "circulation") this.fetchCirculationData();
        if (viewName === "members") this.fetchMembers();
        if (viewName === "ai-hub") this.populateAiHubDropdowns();
        if (viewName === "login") this.prepareLoginView();
        if (viewName === "my-account") this.fetchUserProfile();
    }

    switchSubTab(subName) {
        this.state.currentSubTab = subName;
        document.querySelectorAll(".sub-tab").forEach(tab => {
            if (tab.getAttribute("data-sub") === subName) tab.classList.add("active");
            else tab.classList.remove("active");
        });

        document.querySelectorAll(".sub-panel").forEach(panel => {
            if (panel.id === `sub-panel-${subName}`) panel.classList.add("active");
            else panel.classList.remove("active");
        });

        if (subName === "issue-form") this.populateIssueForm();
        if (subName === "return-form") this.populateReturnForm();
        if (subName === "loan-history") this.fetchLoanHistory();
    }

    setViewMode(mode) {
        this.state.viewMode = mode;
        const grid = document.getElementById("books-grid-container");
        const tableWrapper = document.getElementById("books-table-wrapper");
        const btnGrid = document.getElementById("btn-view-grid");
        const btnTable = document.getElementById("btn-view-table");

        if (mode === "grid") {
            grid?.classList.remove("hidden");
            tableWrapper?.classList.add("hidden");
            btnGrid?.classList.add("active");
            btnTable?.classList.remove("active");
        } else {
            grid?.classList.add("hidden");
            tableWrapper?.classList.remove("hidden");
            btnGrid?.classList.remove("active");
            btnTable?.classList.add("active");
        }
    }

    // ----------------------------------------------------
    // DATA FETCHING & RENDERING
    // ----------------------------------------------------
    async loadInitialData() {
        try {
            await Promise.all([
                this.fetchDashboard(),
                this.fetchBooks(),
                this.fetchMembers(),
                this.fetchCirculationData()
            ]);
        } catch (err) {
            console.error("Initial load error:", err);
        }
    }

    async fetchDashboard(showToast = false) {
        try {
            const res = await fetch("/api/analytics/dashboard");
            const result = await res.json();
            if (result.success) {
                this.state.dashboard = result.data;
                this.renderDashboard(result.data);
                if (showToast) this.showToast("Dashboard stats updated", "success");
            }
        } catch (err) {
            console.error("Dashboard fetch error:", err);
        }
    }

    renderDashboard(data) {
        const { kpis, categoryBreakdown, topBooks, recentActivity, engineInfo } = data;

        // KPIs
        document.getElementById("kpi-titles").textContent = kpis.totalTitles;
        document.getElementById("kpi-copies-sub").textContent = `${kpis.totalCopies} Total Copies in Stacks`;
        document.getElementById("kpi-available").textContent = kpis.availableCopies;
        document.getElementById("kpi-active-loans").textContent = kpis.activeLoans;
        document.getElementById("kpi-issued-sub").textContent = `${kpis.issuedCopies} Copies Currently Out`;
        document.getElementById("kpi-overdue").textContent = kpis.overdueLoans;
        document.getElementById("kpi-fines-sub").textContent = `Pending fines: $${kpis.pendingFines}`;
        document.getElementById("kpi-members").textContent = kpis.totalMembers;
        document.getElementById("kpi-collected-fines").textContent = `$${kpis.collectedFines}`;

        // Counters & Badges
        document.getElementById("catalog-count").textContent = kpis.totalTitles;
        document.getElementById("active-loans-pill").textContent = kpis.activeLoans;
        document.getElementById("active-loans-count-badge").textContent = `${kpis.activeLoans} active loans`;

        // DB Status Widget in sidebar & settings
        const engineLabel = engineInfo ? engineInfo.engine.toUpperCase() + " DB" : "EMBEDDED DB";
        document.getElementById("db-engine-label").textContent = engineLabel;
        document.getElementById("settings-engine-val").textContent = engineLabel;
        if (engineInfo && engineInfo.file) {
            document.getElementById("settings-db-file").textContent = engineInfo.file;
        }

        // Category Breakdown Bars
        const catList = document.getElementById("category-bars-list");
        if (catList && categoryBreakdown) {
            const total = Object.values(categoryBreakdown).reduce((a, b) => a + b, 0) || 1;
            catList.innerHTML = Object.entries(categoryBreakdown).map(([cat, count]) => {
                const pct = Math.round((count / total) * 100);
                return `
                    <div class="cat-bar-item">
                        <div class="cat-bar-meta">
                            <span>${cat}</span>
                            <strong>${count} books (${pct}%)</strong>
                        </div>
                        <div class="cat-bar-track">
                            <div class="cat-bar-fill" style="width: ${pct}%;"></div>
                        </div>
                    </div>
                `;
            }).join("");
        }

        // Top Books
        const topBooksList = document.getElementById("top-books-list");
        if (topBooksList && topBooks) {
            topBooksList.innerHTML = topBooks.map((b, idx) => `
                <div class="top-book-item" onclick="app.showBookDetails(${b.id})">
                    <img src="${b.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100'}" class="top-book-thumb" alt="${b.title}">
                    <div class="top-book-info">
                        <h4>${b.title}</h4>
                        <small>By ${b.author}</small>
                    </div>
                    <span class="top-book-badge">${b.borrow_count} loans</span>
                </div>
            `).join("");
        }

        // Recent Activity
        const activityList = document.getElementById("recent-activity-list");
        if (activityList && recentActivity) {
            activityList.innerHTML = recentActivity.map(item => `
                <div class="activity-item">
                    <div class="activity-badge-icon ${item.type}">
                        <i class="fa-solid ${item.type === 'return' ? 'fa-arrow-down' : (item.type === 'overdue' ? 'fa-triangle-exclamation' : 'fa-arrow-up')}"></i>
                    </div>
                    <div class="activity-text">
                        <strong>${item.memberName}</strong> ${item.type === 'return' ? 'returned' : 'borrowed'} <em>${item.bookTitle}</em>
                        <div class="activity-time">${item.date} • ${item.status}</div>
                    </div>
                </div>
            `).join("");
        }
    }

    async fetchBooks() {
        try {
            const res = await fetch("/api/books");
            const result = await res.json();
            if (result.success) {
                this.state.books = result.data;
                this.filterCatalog();
            }
        } catch (err) {
            console.error("Fetch books error:", err);
        }
    }

    filterCatalog() {
        const query = document.getElementById("catalog-search")?.value.toLowerCase().trim() || "";
        const catFilter = document.getElementById("catalog-category-filter")?.value || "All";
        const stockFilter = document.getElementById("catalog-stock-filter")?.value || "all";
        const sortBy = document.getElementById("catalog-sort")?.value || "id_desc";

        let filtered = [...this.state.books];

        if (catFilter !== "All") {
            filtered = filtered.filter(b => b.category && b.category.toLowerCase() === catFilter.toLowerCase());
        }

        if (stockFilter === "available") {
            filtered = filtered.filter(b => Number(b.available_quantity) > 0);
        } else if (stockFilter === "out_of_stock") {
            filtered = filtered.filter(b => Number(b.available_quantity) === 0);
        }

        if (query) {
            filtered = filtered.filter(b =>
                (b.title && b.title.toLowerCase().includes(query)) ||
                (b.author && b.author.toLowerCase().includes(query)) ||
                (b.isbn && b.isbn.toLowerCase().includes(query)) ||
                (b.tags && b.tags.toLowerCase().includes(query))
            );
        }

        if (sortBy === "rating_desc") filtered.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
        if (sortBy === "title_asc") filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        if (sortBy === "year_desc") filtered.sort((a, b) => Number(b.published_year || 0) - Number(a.published_year || 0));

        this.renderCatalog(filtered);
    }

    renderCatalog(books) {
        const grid = document.getElementById("books-grid-container");
        const tbody = document.getElementById("books-table-body");

        if (!grid || !tbody) return;

        if (books.length === 0) {
            grid.innerHTML = `
                <div class="empty-state-hint" style="grid-column: 1/-1;">
                    <i class="fa-solid fa-book-open"></i>
                    <span>No books matching your criteria. Try adjusting your search filters.</span>
                </div>
            `;
            tbody.innerHTML = `<tr><td colspan="6" class="text-center">No books found</td></tr>`;
            return;
        }

        // Render Grid
        grid.innerHTML = books.map(b => {
            const avail = Number(b.available_quantity) || 0;
            const total = Number(b.quantity) || 1;
            const pct = Math.round((avail / total) * 100);
            const isAvail = avail > 0;
            const barClass = pct > 50 ? "bg-emerald" : (pct > 20 ? "bg-warning" : "bg-danger");

            return `
                <div class="book-card" id="book-card-${b.id}">
                    <div class="book-card-cover-wrap">
                        <img src="${b.cover_url || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500'}" class="book-card-cover" alt="${b.title}" loading="lazy">
                        <span class="book-category-pill">${b.category}</span>
                        <span class="book-rating-pill"><i class="fa-solid fa-star"></i> ${b.rating}</span>
                    </div>

                    <div class="book-card-body">
                        <h3 class="book-title" title="${b.title}">${b.title}</h3>
                        <span class="book-author">by ${b.author}</span>
                        <p class="book-description-snippet">${b.description || "No overview available."}</p>

                        <div class="book-stock-bar-wrap">
                            <div class="book-stock-label">
                                <span>${isAvail ? `${avail} of ${total} Copies Available` : 'Out of Stock'}</span>
                                <span class="${isAvail ? 'text-success' : 'text-danger'}">${pct}%</span>
                            </div>
                            <div class="book-stock-bar">
                                <div class="book-stock-fill" style="width: ${pct}%; background: ${isAvail ? 'var(--emerald)' : 'var(--rose)'};"></div>
                            </div>
                        </div>

                        <div class="book-card-footer">
                            <button class="btn btn-secondary btn-xs" onclick="app.showBookDetails(${b.id})">
                                <i class="fa-solid fa-eye"></i> Details
                            </button>
                            <button class="btn btn-primary btn-xs" onclick="app.quickIssueBook(${b.id})" ${!isAvail ? 'disabled title="Out of Stock"' : ''}>
                                <i class="fa-solid fa-arrow-up-right-from-square"></i> Issue
                            </button>
                            <button class="btn btn-outline btn-xs" onclick="app.editBook(${b.id})" title="Edit Book">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn btn-outline btn-xs text-danger" onclick="app.deleteBook(${b.id})" title="Delete Book">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        // Render Table
        tbody.innerHTML = books.map(b => `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="${b.cover_url}" style="width:36px; height:48px; object-fit:cover; border-radius:4px;">
                        <div>
                            <strong>${b.title}</strong>
                            <div style="font-size:0.75rem; color:var(--text-dim);">by ${b.author} (${b.published_year})</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge badge-info">${b.category}</span></td>
                <td><code>${b.isbn}</code></td>
                <td><strong>${b.available_quantity}</strong> / ${b.quantity}</td>
                <td><span class="text-warning"><i class="fa-solid fa-star"></i> ${b.rating}</span></td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-xs btn-secondary" onclick="app.showBookDetails(${b.id})"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn btn-xs btn-primary" onclick="app.quickIssueBook(${b.id})" ${b.available_quantity <= 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
                        <button class="btn btn-xs btn-outline" onclick="app.editBook(${b.id})"><i class="fa-solid fa-pen"></i></button>
                    </div>
                </td>
            </tr>
        `).join("");
    }

    async fetchMembers() {
        try {
            const res = await fetch("/api/members");
            const result = await res.json();
            if (result.success) {
                this.state.members = result.data;
                this.renderMembers(result.data);
            }
        } catch (err) {
            console.error("Fetch members error:", err);
        }
    }

    filterMembers() {
        const query = document.getElementById("member-search")?.value.toLowerCase().trim() || "";
        const tier = document.getElementById("member-tier-filter")?.value || "All";

        let filtered = [...this.state.members];
        if (tier !== "All") filtered = filtered.filter(m => m.tier && m.tier.toLowerCase() === tier.toLowerCase());
        if (query) {
            filtered = filtered.filter(m =>
                (m.name && m.name.toLowerCase().includes(query)) ||
                (m.member_code && m.member_code.toLowerCase().includes(query)) ||
                (m.email && m.email.toLowerCase().includes(query))
            );
        }
        this.renderMembers(filtered);
    }

    renderMembers(members) {
        const container = document.getElementById("members-grid-container");
        if (!container) return;

        if (members.length === 0) {
            container.innerHTML = `<div class="empty-state-hint" style="grid-column:1/-1;"><span>No members found.</span></div>`;
            return;
        }

        container.innerHTML = members.map(m => `
            <div class="member-card">
                <div class="member-card-header">
                    <div class="member-avatar">${m.name.charAt(0)}</div>
                    <div class="member-meta">
                        <h4>${m.name}</h4>
                        <span class="member-code-badge">${m.member_code} • <strong class="text-accent">${m.tier}</strong></span>
                    </div>
                    <span class="badge ${m.status === 'Active' ? 'badge-success' : 'badge-danger'}" style="margin-left:auto;">${m.status}</span>
                </div>

                <div class="member-details-list">
                    <div><i class="fa-solid fa-envelope"></i> ${m.email}</div>
                    <div><i class="fa-solid fa-phone"></i> ${m.phone || 'No phone recorded'}</div>
                </div>

                <div class="member-stats-row">
                    <div>Active Borrowed: <strong>${m.active_loans_count || 0} / ${m.max_books || 5}</strong></div>
                    <div>Unpaid Fines: <strong class="${m.total_fines_unpaid > 0 ? 'text-danger' : 'text-success'}">$${(m.total_fines_unpaid || 0).toFixed(2)}</strong></div>
                </div>

                <div style="display:flex; gap:8px; margin-top:8px;">
                    <button class="btn btn-xs btn-secondary flex-1" onclick="app.showMemberLoans(${m.id})">
                        <i class="fa-solid fa-clock-rotate-left"></i> Loan Record
                    </button>
                    <button class="btn btn-xs btn-outline" onclick="app.editMember(${m.id})" title="Edit Member">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                </div>
            </div>
        `).join("");
    }

    async fetchCirculationData() {
        try {
            const [activeRes, histRes] = await Promise.all([
                fetch("/api/transactions/active"),
                fetch("/api/transactions")
            ]);
            const activeData = await activeRes.json();
            const histData = await histRes.json();

            if (activeData.success) {
                this.state.activeLoans = activeData.data;
                this.renderActiveLoans(activeData.data);
            }
            if (histData.success) {
                this.state.allTransactions = histData.data;
            }
        } catch (err) {
            console.error("Circulation fetch error:", err);
        }
    }

    renderActiveLoans(loans) {
        const tbody = document.getElementById("active-loans-tbody");
        if (!tbody) return;

        if (loans.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 24px;">No active book loans at present. All books are checked in!</td></tr>`;
            return;
        }

        tbody.innerHTML = loans.map(l => {
            const isOverdue = l.is_overdue;
            return `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <img src="${l.book_cover || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100'}" style="width:34px; height:46px; object-fit:cover; border-radius:4px;">
                            <div>
                                <strong>${l.book_title}</strong>
                                <div style="font-size:0.75rem; color:var(--text-dim);">${l.book_author}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <strong>${l.member_name}</strong>
                        <div style="font-size:0.75rem; color:var(--text-dim);">${l.member_code}</div>
                    </td>
                    <td>${l.issue_date}</td>
                    <td><strong>${l.due_date}</strong></td>
                    <td>
                        <span class="badge ${isOverdue ? 'badge-danger' : 'badge-success'}">
                            ${isOverdue ? `Overdue (${l.overdue_days}d)` : 'Active Loan'}
                        </span>
                    </td>
                    <td>
                        <strong class="${isOverdue ? 'text-danger' : 'text-muted'}">
                            $${(l.calculated_fine || 0).toFixed(2)}
                        </strong>
                    </td>
                    <td>
                        <div style="display:flex; gap:6px;">
                            <button class="btn btn-xs btn-emerald" onclick="app.quickReturnLoan(${l.id})" title="Check in this book">
                                <i class="fa-solid fa-arrow-down-to-bracket"></i> Return
                            </button>
                            <button class="btn btn-xs btn-outline" onclick="app.renewLoan(${l.id})" title="Extend loan by 7 days">
                                <i class="fa-solid fa-rotate"></i> Renew
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    populateIssueForm() {
        const bookSelect = document.getElementById("issue-book-select");
        const memberSelect = document.getElementById("issue-member-select");

        if (bookSelect) {
            bookSelect.innerHTML = `<option value="">Choose an available book...</option>` +
                this.state.books
                    .filter(b => Number(b.available_quantity) > 0)
                    .map(b => `<option value="${b.id}">${b.title} (${b.available_quantity} in stock)</option>`)
                    .join("");
        }

        if (memberSelect) {
            memberSelect.innerHTML = `<option value="">Choose active member...</option>` +
                this.state.members
                    .filter(m => m.status === "Active")
                    .map(m => `<option value="${m.id}">${m.name} (${m.member_code} - ${m.tier})</option>`)
                    .join("");
        }
    }

    populateReturnForm() {
        const select = document.getElementById("return-loan-select");
        if (!select) return;

        select.innerHTML = `<option value="">Select active loan record to check in...</option>` +
            this.state.activeLoans.map(l => `
                <option value="${l.id}">
                    ${l.book_title} (Borrower: ${l.member_name} - Due: ${l.due_date})
                </option>
            `).join("");
    }

    handleReturnLoanSelect(e) {
        const txId = e.target.value;
        const previewBox = document.getElementById("return-preview-box");

        if (!txId) {
            previewBox?.classList.add("hidden");
            return;
        }

        const loan = this.state.activeLoans.find(l => Number(l.id) === Number(txId));
        if (loan && previewBox) {
            previewBox.classList.remove("hidden");
            document.getElementById("preview-loan-status").textContent = loan.is_overdue ? "OVERDUE" : "On Time";
            document.getElementById("preview-loan-due").textContent = loan.due_date;
            document.getElementById("preview-loan-overdue-days").textContent = `${loan.overdue_days || 0} days`;
            document.getElementById("preview-loan-fine").textContent = `$${(loan.calculated_fine || 0).toFixed(2)}`;
        }
    }

    async fetchLoanHistory() {
        const tbody = document.getElementById("history-loans-tbody");
        if (!tbody) return;

        try {
            const res = await fetch("/api/transactions");
            const result = await res.json();
            if (result.success) {
                tbody.innerHTML = result.data.map(t => `
                    <tr>
                        <td>#${t.id}</td>
                        <td><strong>${t.book_title}</strong></td>
                        <td>${t.member_name}</td>
                        <td>${t.issue_date}</td>
                        <td>${t.due_date}</td>
                        <td>${t.return_date || '-'}</td>
                        <td><span class="badge ${t.status === 'Returned' ? 'badge-success' : (t.status === 'Overdue' ? 'badge-danger' : 'badge-info')}">${t.status}</span></td>
                        <td>$${parseFloat(t.fine_amount || 0).toFixed(2)}</td>
                    </tr>
                `).join("");
            }
        } catch (err) {
            console.error(err);
        }
    }

    // ----------------------------------------------------
    // ACTIONS & HANDLERS
    // ----------------------------------------------------
    async handleSaveBook(e) {
        e.preventDefault();
        const id = document.getElementById("book-edit-id")?.value;
        const payload = {
            title: document.getElementById("book-input-title").value.trim(),
            author: document.getElementById("book-input-author").value.trim(),
            category: document.getElementById("book-input-category").value.trim(),
            isbn: document.getElementById("book-input-isbn").value.trim(),
            quantity: document.getElementById("book-input-quantity").value,
            cover_url: document.getElementById("book-input-cover").value.trim(),
            published_year: document.getElementById("book-input-year").value,
            rating: document.getElementById("book-input-rating").value,
            tags: document.getElementById("book-input-tags").value.trim(),
            description: document.getElementById("book-input-desc").value.trim()
        };

        try {
            const url = id ? `/api/books/${id}` : "/api/books";
            const method = id ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (result.success) {
                this.showToast(result.message, "success");
                document.getElementById("modal-book")?.classList.remove("active");
                await this.fetchBooks();
                await this.fetchDashboard();
            } else {
                this.showToast(result.message, "error");
            }
        } catch (err) {
            this.showToast("Error saving book", "error");
        }
    }

    async handleAiAutoFill() {
        const title = document.getElementById("book-input-title")?.value.trim();
        const author = document.getElementById("book-input-author")?.value.trim();

        if (!title) {
            this.showToast("Please enter at least a Book Title first!", "warning");
            return;
        }

        this.showToast("Athena AI generating metadata...", "info");
        try {
            const res = await fetch("/api/ai/auto-catalog", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, author })
            });
            const result = await res.json();

            if (result.success) {
                const d = result.data;
                document.getElementById("book-input-category").value = d.category;
                document.getElementById("book-input-tags").value = d.tags;
                document.getElementById("book-input-desc").value = d.description;
                if (!document.getElementById("book-input-isbn").value) {
                    document.getElementById("book-input-isbn").value = d.isbn;
                }
                this.showToast("AI Auto-Fill successfully populated metadata!", "success");
            }
        } catch (err) {
            this.showToast("AI Auto-Fill encountered an issue", "error");
        }
    }

    async editBook(id) {
        const book = this.state.books.find(b => Number(b.id) === Number(id));
        if (!book) return;

        document.getElementById("book-edit-id").value = book.id;
        document.getElementById("book-input-title").value = book.title;
        document.getElementById("book-input-author").value = book.author;
        document.getElementById("book-input-category").value = book.category;
        document.getElementById("book-input-isbn").value = book.isbn || "";
        document.getElementById("book-input-quantity").value = book.quantity;
        document.getElementById("book-input-cover").value = book.cover_url || "";
        document.getElementById("book-input-year").value = book.published_year || 2024;
        document.getElementById("book-input-rating").value = book.rating || 4.5;
        document.getElementById("book-input-tags").value = book.tags || "";
        document.getElementById("book-input-desc").value = book.description || "";

        document.getElementById("modal-book-title").textContent = `Edit: ${book.title}`;
        document.getElementById("modal-book")?.classList.add("active");
    }

    async deleteBook(id) {
        if (!confirm("Are you sure you want to remove this book from the catalog?")) return;

        try {
            const res = await fetch(`/api/books/${id}`, { method: "DELETE" });
            const result = await res.json();
            if (result.success) {
                this.showToast(result.message, "success");
                await this.fetchBooks();
                await this.fetchDashboard();
            } else {
                this.showToast(result.message, "error");
            }
        } catch (err) {
            this.showToast("Error deleting book", "error");
        }
    }

    async handleSaveMember(e) {
        e.preventDefault();
        const payload = {
            name: document.getElementById("member-input-name").value.trim(),
            email: document.getElementById("member-input-email").value.trim(),
            phone: document.getElementById("member-input-phone").value.trim(),
            tier: document.getElementById("member-input-tier").value,
            status: document.getElementById("member-input-status").value
        };

        try {
            const res = await fetch("/api/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (result.success) {
                this.showToast(result.message, "success");
                document.getElementById("modal-member")?.classList.remove("active");
                await this.fetchMembers();
                await this.fetchDashboard();
            } else {
                this.showToast(result.message, "error");
            }
        } catch (err) {
            this.showToast("Error registering member", "error");
        }
    }

    quickIssueBook(bookId) {
        this.switchView("circulation");
        this.switchSubTab("issue-form");
        const select = document.getElementById("issue-book-select");
        if (select) select.value = bookId;
    }

    async handleIssueBook(e) {
        e.preventDefault();
        const bookId = document.getElementById("issue-book-select")?.value;
        const memberId = document.getElementById("issue-member-select")?.value;
        const loanDays = document.getElementById("issue-loan-days")?.value;
        const notes = document.getElementById("issue-notes")?.value;

        try {
            const res = await fetch("/api/transactions/issue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ book_id: bookId, member_id: memberId, loan_days: loanDays, notes })
            });
            const result = await res.json();

            if (result.success) {
                this.showToast(result.message, "success");
                document.getElementById("form-issue-book")?.reset();
                await this.fetchCirculationData();
                await this.fetchBooks();
                await this.fetchDashboard();
                this.switchSubTab("active-loans");
            } else {
                this.showToast(result.message, "error");
            }
        } catch (err) {
            this.showToast("Error issuing book", "error");
        }
    }

    async quickReturnLoan(txId) {
        this.switchView("circulation");
        this.switchSubTab("return-form");
        const select = document.getElementById("return-loan-select");
        if (select) {
            select.value = txId;
            select.dispatchEvent(new Event("change"));
        }
    }

    async handleReturnBook(e) {
        e.preventDefault();
        const txId = document.getElementById("return-loan-select")?.value;
        const notes = document.getElementById("return-notes")?.value;
        const waiveFine = document.getElementById("waive-fine-check")?.checked;

        try {
            const res = await fetch("/api/transactions/return", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transaction_id: txId, notes, waive_fine: waiveFine })
            });
            const result = await res.json();

            if (result.success) {
                const fineMsg = result.fine_amount > 0 ? ` (Fine accrued: $${result.fine_amount})` : "";
                this.showToast(result.message + fineMsg, "success");
                document.getElementById("form-return-book")?.reset();
                document.getElementById("return-preview-box")?.classList.add("hidden");
                await this.fetchCirculationData();
                await this.fetchBooks();
                await this.fetchDashboard();
                this.switchSubTab("active-loans");
            } else {
                this.showToast(result.message, "error");
            }
        } catch (err) {
            this.showToast("Error processing return", "error");
        }
    }

    async renewLoan(txId) {
        try {
            const res = await fetch(`/api/transactions/renew/${txId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ extend_days: 7 })
            });
            const result = await res.json();
            if (result.success) {
                this.showToast(result.message, "success");
                await this.fetchCirculationData();
            } else {
                this.showToast(result.message, "error");
            }
        } catch (err) {
            this.showToast("Error renewing loan", "error");
        }
    }

    async showBookDetails(id) {
        try {
            const res = await fetch(`/api/books/${id}`);
            const result = await res.json();
            if (!result.success) return;

            const b = result.data;
            const content = document.getElementById("book-details-content");
            if (!content) return;

            content.innerHTML = `
                <div style="display:flex; gap:24px; flex-wrap:wrap;">
                    <img src="${b.cover_url}" style="width:180px; height:250px; object-fit:cover; border-radius:12px; box-shadow:var(--shadow-md);">
                    <div style="flex:1; min-width:260px;">
                        <h2>${b.title}</h2>
                        <h4 style="color:var(--text-dim); margin-bottom:12px;">by ${b.author} (${b.published_year})</h4>
                        
                        <div style="display:flex; gap:10px; margin-bottom:16px;">
                            <span class="badge badge-info">${b.category}</span>
                            <span class="badge badge-success">${b.available_quantity} of ${b.quantity} Available</span>
                            <span class="badge badge-warning"><i class="fa-solid fa-star"></i> ${b.rating}</span>
                        </div>

                        <p style="font-size:0.9rem; line-height:1.6; color:var(--text-muted); margin-bottom:16px;">
                            ${b.description || "No overview available."}
                        </p>

                        <div style="font-size:0.82rem; color:var(--text-dim); display:flex; flex-direction:column; gap:6px;">
                            <div><strong>ISBN:</strong> ${b.isbn}</div>
                            <div><strong>Key Tags:</strong> ${b.tags || "None"}</div>
                        </div>
                    </div>
                </div>
            `;

            // Wire detail modal buttons
            const issueBtn = document.getElementById("btn-details-issue");
            if (issueBtn) {
                issueBtn.onclick = () => {
                    document.getElementById("modal-book-details")?.classList.remove("active");
                    this.quickIssueBook(b.id);
                };
            }

            const summarizeBtn = document.getElementById("btn-details-summarize");
            if (summarizeBtn) {
                summarizeBtn.onclick = () => {
                    document.getElementById("modal-book-details")?.classList.remove("active");
                    this.switchView("ai-hub");
                    const sel = document.getElementById("summarizer-book-select");
                    if (sel) {
                        sel.value = b.id;
                        this.handleSummarizer();
                    }
                };
            }

            document.getElementById("modal-book-details")?.classList.add("active");
        } catch (err) {
            console.error(err);
        }
    }

    async showMemberLoans(id) {
        try {
            const res = await fetch(`/api/members/${id}`);
            const result = await res.json();
            if (result.success) {
                const m = result.data;
                let loanItems = m.loans.map(l => `
                    <div style="padding:10px; border-bottom:1px solid var(--border-color); font-size:0.85rem;">
                        <strong>${l.book_title}</strong> (Issued: ${l.issue_date} | Due: ${l.due_date} | Status: ${l.status})
                    </div>
                `).join("");

                if (m.loans.length === 0) loanItems = `<p style="padding:12px; color:var(--text-dim);">No loans recorded for this member.</p>`;

                alert(`Borrowing Records for ${m.name} (${m.member_code}):\nActive: ${m.active_loans_count} | Fines: $${m.total_fines_unpaid.toFixed(2)}\n\n(See Circulation tab for full transaction logs)`);
            }
        } catch (err) {
            console.error(err);
        }
    }

    // ----------------------------------------------------
    // AI HUB FEATURES
    // ----------------------------------------------------
    populateAiHubDropdowns() {
        const sumSelect = document.getElementById("summarizer-book-select");
        const recSelect = document.getElementById("recommend-member-select");

        if (sumSelect) {
            sumSelect.innerHTML = `<option value="">Choose a book to summarize...</option>` +
                this.state.books.map(b => `<option value="${b.id}">${b.title} (${b.author})</option>`).join("");
        }

        if (recSelect) {
            recSelect.innerHTML = `<option value="">Select a member profile...</option>` +
                this.state.members.map(m => `<option value="${m.id}">${m.name} (${m.tier})</option>`).join("");
        }
    }

    async handleSemanticSearch() {
        const query = document.getElementById("ai-semantic-query")?.value.trim();
        const container = document.getElementById("semantic-results-container");

        if (!query) {
            this.showToast("Please enter a semantic query first!", "warning");
            return;
        }

        container.innerHTML = `<div class="empty-state-hint"><i class="fa-solid fa-spinner fa-spin"></i><span>Analyzing semantic intent across catalog...</span></div>`;

        try {
            const res = await fetch("/api/ai/semantic-search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query })
            });
            const result = await res.json();

            if (result.success && result.data.length > 0) {
                container.innerHTML = result.data.map(b => `
                    <div class="semantic-result-card" onclick="app.showBookDetails(${b.id})">
                        <div style="display:flex; align-items:center; gap:14px;">
                            <img src="${b.cover_url}" style="width:48px; height:68px; object-fit:cover; border-radius:6px;">
                            <div>
                                <h4 style="font-size:1rem; margin-bottom:4px;">${b.title}</h4>
                                <div style="font-size:0.8rem; color:var(--text-dim); margin-bottom:6px;">by ${b.author} • ${b.category}</div>
                                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                                    ${(b.match_reasons || []).map(r => `<span class="badge badge-info" style="font-size:0.65rem;">Match: ${r}</span>`).join("")}
                                </div>
                            </div>
                        </div>
                        <div class="sem-match-badge">
                            <div class="sem-match-score">${b.semantic_score}%</div>
                            <div class="sem-match-label">Relevance</div>
                        </div>
                    </div>
                `).join("");
            } else {
                container.innerHTML = `<div class="empty-state-hint"><span>No close semantic matches found. Try rephrasing your search.</span></div>`;
            }
        } catch (err) {
            container.innerHTML = `<div class="empty-state-hint text-danger"><span>Semantic search failed.</span></div>`;
        }
    }

    async handleSummarizer() {
        const bookId = document.getElementById("summarizer-book-select")?.value;
        const box = document.getElementById("summarizer-result-box");

        if (!bookId) {
            this.showToast("Please select a book to summarize!", "warning");
            return;
        }

        box?.classList.remove("hidden");
        box.innerHTML = `<div class="empty-state-hint"><i class="fa-solid fa-spinner fa-spin"></i><span>Athena AI analyzing book content and generating insights...</span></div>`;

        try {
            const res = await fetch("/api/ai/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ book_id: bookId })
            });
            const result = await res.json();

            if (result.success) {
                const d = result.data;
                box.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                        <div>
                            <h3>${d.title}</h3>
                            <h5 style="color:var(--text-dim);">by ${d.author} (${d.category})</h5>
                        </div>
                        <span class="badge badge-warning"><i class="fa-solid fa-star"></i> ${d.rating}</span>
                    </div>

                    <p style="font-size:0.92rem; line-height:1.6; color:var(--text-muted); margin-bottom:16px;">
                        ${d.synopsis}
                    </p>

                    <div class="summary-meta-chips">
                        <div class="summary-meta-chip"><i class="fa-solid fa-gauge-high"></i> <strong>Difficulty:</strong> ${d.difficulty}</div>
                        <div class="summary-meta-chip"><i class="fa-solid fa-clock"></i> <strong>Est. Reading Time:</strong> ${d.estimated_reading_time}</div>
                        <div class="summary-meta-chip"><i class="fa-solid fa-bullseye"></i> <strong>Audience:</strong> ${d.target_audience}</div>
                    </div>

                    <div class="takeaway-box">
                        <h4 style="margin-bottom:10px;"><i class="fa-solid fa-lightbulb text-warning"></i> Core Takeaways & Themes</h4>
                        ${d.key_takeaways.map(t => `
                            <div class="takeaway-item">
                                <i class="fa-solid fa-check text-emerald" style="margin-top:4px;"></i>
                                <span>${t}</span>
                            </div>
                        `).join("")}
                    </div>

                    <div style="margin-top:16px; padding:12px; background:rgba(99,102,241,0.1); border-radius:var(--radius-md); font-size:0.85rem;">
                        <strong>Athena Recommendation Verdict:</strong> ${d.ai_recommendation_verdict}
                    </div>
                `;
            }
        } catch (err) {
            box.innerHTML = `<div class="empty-state-hint text-danger"><span>Failed to generate summary.</span></div>`;
        }
    }

    async handleRecommendations() {
        const memberId = document.getElementById("recommend-member-select")?.value;
        const container = document.getElementById("recommend-results-container");

        container.innerHTML = `<div class="empty-state-hint"><i class="fa-solid fa-spinner fa-spin"></i><span>Generating customized reading path...</span></div>`;

        try {
            const res = await fetch("/api/ai/recommend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ member_id: memberId })
            });
            const result = await res.json();

            if (result.success && result.data.length > 0) {
                container.innerHTML = result.data.map(b => `
                    <div class="semantic-result-card" onclick="app.showBookDetails(${b.id})">
                        <div style="display:flex; align-items:center; gap:14px;">
                            <img src="${b.cover_url}" style="width:48px; height:68px; object-fit:cover; border-radius:6px;">
                            <div>
                                <h4 style="font-size:1rem; margin-bottom:4px;">${b.title}</h4>
                                <div style="font-size:0.8rem; color:var(--text-dim);">${b.author} • ${b.category}</div>
                                <div style="font-size:0.75rem; color:var(--emerald); margin-top:4px;">${b.recommendation_reason}</div>
                            </div>
                        </div>
                        <div class="sem-match-badge">
                            <div class="sem-match-score" style="color:var(--emerald);">${b.match_percentage}%</div>
                            <div class="sem-match-label">Match Affinity</div>
                        </div>
                    </div>
                `).join("");
            }
        } catch (err) {
            container.innerHTML = `<div class="empty-state-hint text-danger"><span>Failed to fetch recommendations.</span></div>`;
        }
    }

    // ----------------------------------------------------
    // ATHENA CONVERSATIONAL ASSISTANT
    // ----------------------------------------------------
    async sendAthenaMessage(text) {
        const body = document.getElementById("athena-messages-body");
        if (!body) return;

        // Append User Message
        const userMsg = document.createElement("div");
        userMsg.className = "chat-message user";
        userMsg.innerHTML = `
            <div class="msg-avatar"><i class="fa-solid fa-user"></i></div>
            <div class="msg-content">${this.escapeHtml(text)}</div>
        `;
        body.appendChild(userMsg);
        body.scrollTop = body.scrollHeight;

        // Temporary Assistant Typing Indicator
        const typingMsg = document.createElement("div");
        typingMsg.className = "chat-message assistant";
        typingMsg.id = "athena-typing";
        typingMsg.innerHTML = `
            <div class="msg-avatar"><i class="fa-solid fa-brain-circuit"></i></div>
            <div class="msg-content"><i class="fa-solid fa-ellipsis fa-fade"></i> Athena is thinking...</div>
        `;
        body.appendChild(typingMsg);
        body.scrollTop = body.scrollHeight;

        try {
            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text })
            });
            const result = await res.json();

            typingMsg.remove();

            if (result.success) {
                const assistantMsg = document.createElement("div");
                assistantMsg.className = "chat-message assistant";
                assistantMsg.innerHTML = `
                    <div class="msg-avatar"><i class="fa-solid fa-brain-circuit"></i></div>
                    <div class="msg-content">${this.formatMarkdown(result.reply)}</div>
                `;
                body.appendChild(assistantMsg);
                body.scrollTop = body.scrollHeight;

                // Update suggested action chips if provided
                const actionsContainer = document.getElementById("athena-suggested-actions");
                if (actionsContainer && result.suggestedActions && result.suggestedActions.length > 0) {
                    actionsContainer.innerHTML = result.suggestedActions.map(act => `
                        <button class="chip-sm" onclick="app.sendAthenaMessage('${act}')">${act}</button>
                    `).join("");
                }
            }
        } catch (err) {
            typingMsg.remove();
            const errMsg = document.createElement("div");
            errMsg.className = "chat-message assistant";
            errMsg.innerHTML = `
                <div class="msg-avatar"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div class="msg-content text-danger">Sorry, I encountered an error answering your question. Please try again!</div>
            `;
            body.appendChild(errMsg);
            body.scrollTop = body.scrollHeight;
        }
    }

    // ----------------------------------------------------
    // UTILITIES
    // ----------------------------------------------------
    showToast(message, type = "info") {
        const container = document.getElementById("toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        
        let icon = "fa-circle-info";
        if (type === "success") icon = "fa-circle-check";
        if (type === "error") icon = "fa-triangle-exclamation";
        if (type === "warning") icon = "fa-triangle-exclamation";

        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(30px)";
            toast.style.transition = "all 0.3s ease";
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    escapeHtml(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    formatMarkdown(text) {
        if (!text) return "";
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
    }

    // ----------------------------------------------------
    // AUTHENTICATION & MY ACCOUNT METHODS
    // ----------------------------------------------------
    bindAuthEvents() {
        // Profile dropdown menu toggle
        const profileBadge = document.getElementById("btn-user-profile-badge");
        const profileDropdown = document.getElementById("user-profile-dropdown");
        const headerWidget = document.getElementById("user-header-widget");

        profileBadge?.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!this.state.currentUser) {
                this.switchView("login");
                return;
            }
            profileDropdown?.classList.toggle("hidden");
            headerWidget?.classList.toggle("open");
        });

        // Close dropdown when clicking outside
        document.addEventListener("click", (e) => {
            if (headerWidget && !headerWidget.contains(e.target)) {
                profileDropdown?.classList.add("hidden");
                headerWidget.classList.remove("open");
            }
        });

        // Dropdown actions
        document.getElementById("dropdown-btn-my-account")?.addEventListener("click", () => {
            profileDropdown?.classList.add("hidden");
            headerWidget?.classList.remove("open");
            this.switchView("my-account");
        });

        document.getElementById("dropdown-btn-login-page")?.addEventListener("click", () => {
            profileDropdown?.classList.add("hidden");
            headerWidget?.classList.remove("open");
            this.switchView("login");
        });

        document.getElementById("dropdown-btn-logout")?.addEventListener("click", () => {
            profileDropdown?.classList.add("hidden");
            headerWidget?.classList.remove("open");
            this.handleLogout();
        });

        // Auth Tabs switcher
        const btnTabSignIn = document.getElementById("tab-btn-signin");
        const btnTabSignUp = document.getElementById("tab-btn-signup");
        const formSignIn = document.getElementById("form-signin");
        const formSignUp = document.getElementById("form-signup");
        const demoBox = document.getElementById("demo-logins-container");
        const authTitle = document.getElementById("auth-main-title");
        const authSubtitle = document.getElementById("auth-main-subtitle");

        btnTabSignIn?.addEventListener("click", () => {
            btnTabSignIn.classList.add("active");
            btnTabSignUp.classList.remove("active");
            formSignIn?.classList.add("active");
            formSignUp?.classList.remove("active");
            if (demoBox) demoBox.style.display = "block";
            if (authTitle) authTitle.textContent = "Welcome to AthenaLib";
            if (authSubtitle) authSubtitle.textContent = "Sign in to your library account to access smart AI search, borrow books, and manage circulation.";
        });

        btnTabSignUp?.addEventListener("click", () => {
            btnTabSignUp.classList.add("active");
            btnTabSignIn.classList.remove("active");
            formSignUp?.classList.add("active");
            formSignIn?.classList.remove("active");
            if (demoBox) demoBox.style.display = "none";
            if (authTitle) authTitle.textContent = "Create Library Account";
            if (authSubtitle) authSubtitle.textContent = "Register today to get an instant digital membership card, borrow physical & AI titles, and access recommendations.";
        });

        // Password visibility toggles
        document.getElementById("btn-toggle-signin-pw")?.addEventListener("click", () => {
            const input = document.getElementById("signin-password");
            const icon = document.querySelector("#btn-toggle-signin-pw i");
            if (input) {
                const isPw = input.type === "password";
                input.type = isPw ? "text" : "password";
                if (icon) icon.className = isPw ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
            }
        });

        document.getElementById("btn-toggle-signup-pw")?.addEventListener("click", () => {
            const input = document.getElementById("signup-password");
            const icon = document.querySelector("#btn-toggle-signup-pw i");
            if (input) {
                const isPw = input.type === "password";
                input.type = isPw ? "text" : "password";
                if (icon) icon.className = isPw ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
            }
        });

        // Form submits
        formSignIn?.addEventListener("submit", (e) => this.handleLogin(e));
        formSignUp?.addEventListener("submit", (e) => this.handleRegister(e));

        // Account Profile settings forms
        document.getElementById("form-update-profile")?.addEventListener("submit", (e) => this.handleUpdateProfile(e));
        document.getElementById("form-change-password")?.addEventListener("submit", (e) => this.handleChangePassword(e));
    }

    updateAuthUI() {
        const user = this.state.currentUser;
        const avatarEl = document.getElementById("header-user-avatar");
        const nameEl = document.getElementById("header-user-name");
        const roleEl = document.getElementById("header-user-role");
        const dropdownAvatar = document.getElementById("dropdown-user-avatar");
        const dropdownName = document.getElementById("dropdown-user-name");
        const dropdownEmail = document.getElementById("dropdown-user-email");
        const dropdownBadge = document.getElementById("dropdown-user-badge");
        const loginNavLabel = document.getElementById("nav-login-label");
        const loanNavBadge = document.getElementById("my-loans-nav-badge");

        if (user) {
            const avatarUrl = user.avatar_url || (user.role === "admin" 
                ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" 
                : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80");

            if (avatarEl) avatarEl.src = avatarUrl;
            if (nameEl) nameEl.textContent = user.name;
            if (roleEl) roleEl.textContent = user.role === "admin" ? "Chief Librarian" : (user.tier ? `${user.tier} Member` : "Member");

            if (dropdownAvatar) dropdownAvatar.src = avatarUrl;
            if (dropdownName) dropdownName.textContent = user.name;
            if (dropdownEmail) dropdownEmail.textContent = user.email;
            if (dropdownBadge) dropdownBadge.textContent = user.role === "admin" ? "Administrator" : (user.tier || "Member");

            if (loginNavLabel) loginNavLabel.textContent = "Switch Account";
            if (loanNavBadge) loanNavBadge.textContent = user.active_loans_count !== undefined ? user.active_loans_count : "0";
        } else {
            if (avatarEl) avatarEl.src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100";
            if (nameEl) nameEl.textContent = "Guest Access";
            if (roleEl) roleEl.textContent = "Click to Sign In";

            if (loginNavLabel) loginNavLabel.textContent = "Sign In / Join";
            if (loanNavBadge) loanNavBadge.textContent = "0";
        }
    }

    async verifySession() {
        if (!this.state.authToken) return;
        try {
            const res = await fetch("/api/auth/me", {
                headers: { "Authorization": `Bearer ${this.state.authToken}` }
            });
            const data = await res.json();
            if (data.success && data.user) {
                this.state.currentUser = data.user;
                localStorage.setItem("athena_user", JSON.stringify(data.user));
                this.updateAuthUI();
            } else {
                this.state.authToken = null;
                this.state.currentUser = null;
                localStorage.removeItem("athena_token");
                localStorage.removeItem("athena_user");
                this.updateAuthUI();
            }
        } catch (err) {
            console.warn("Session verify check:", err.message);
        }
    }

    prepareLoginView() {
        if (this.state.currentUser) {
            const authSubtitle = document.getElementById("auth-main-subtitle");
            if (authSubtitle) {
                authSubtitle.innerHTML = `Currently logged in as <strong>${this.escapeHtml(this.state.currentUser.name)}</strong> (${this.escapeHtml(this.state.currentUser.email)}). You can switch accounts below or view your <a href="#my-account" style="color:var(--primary); font-weight:bold;">Member Dashboard</a>.`;
            }
        }
    }

    quickFillDemo(type) {
        const emailInput = document.getElementById("signin-email");
        const pwInput = document.getElementById("signin-password");
        if (!emailInput || !pwInput) return;

        // Ensure sign in tab is active
        document.getElementById("tab-btn-signin")?.click();

        if (type === "admin") {
            emailInput.value = "admin@athenalib.io";
            pwInput.value = "admin123";
        } else if (type === "student") {
            emailInput.value = "dev.patel@library.edu";
            pwInput.value = "password123";
        } else if (type === "faculty") {
            emailInput.value = "sophia.chen@university.org";
            pwInput.value = "password123";
        }

        this.showToast(`Autofilled demo credentials for ${type.toUpperCase()}`, "info");
        this.submitSignIn(emailInput.value, pwInput.value);
    }

    async handleLogin(e) {
        if (e) e.preventDefault();
        const email = document.getElementById("signin-email")?.value.trim();
        const password = document.getElementById("signin-password")?.value;
        if (!email || !password) {
            this.showToast("Please provide both email and password.", "error");
            return;
        }
        await this.submitSignIn(email, password);
    }

    async submitSignIn(email, password) {
        const btn = document.getElementById("btn-submit-signin");
        const oldHtml = btn ? btn.innerHTML : "";
        if (btn) btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Signing in...`;

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const result = await res.json();

            if (result.success && result.token) {
                this.state.authToken = result.token;
                this.state.currentUser = result.user;
                localStorage.setItem("athena_token", result.token);
                localStorage.setItem("athena_user", JSON.stringify(result.user));

                this.updateAuthUI();
                this.showToast(result.message || "Signed in successfully!", "success");

                // Switch to My Account portal
                this.switchView("my-account");
            } else {
                this.showToast(result.message || "Login failed. Please check credentials.", "error");
            }
        } catch (err) {
            console.error("Sign in error:", err);
            this.showToast("Error connecting to auth server.", "error");
        } finally {
            if (btn) btn.innerHTML = oldHtml;
        }
    }

    async handleRegister(e) {
        if (e) e.preventDefault();
        const name = document.getElementById("signup-name")?.value.trim();
        const email = document.getElementById("signup-email")?.value.trim();
        const phone = document.getElementById("signup-phone")?.value.trim();
        const tier = document.getElementById("signup-tier")?.value;
        const password = document.getElementById("signup-password")?.value;

        if (!name || !email || !password) {
            this.showToast("Please fill in all required fields.", "error");
            return;
        }

        const btn = document.getElementById("btn-submit-signup");
        const oldHtml = btn ? btn.innerHTML : "";
        if (btn) btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Provisioning account...`;

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, phone, tier, password })
            });
            const result = await res.json();

            if (result.success && result.token) {
                this.state.authToken = result.token;
                this.state.currentUser = result.user;
                localStorage.setItem("athena_token", result.token);
                localStorage.setItem("athena_user", JSON.stringify(result.user));

                this.updateAuthUI();
                this.showToast(result.message || "Account registered successfully!", "success");
                this.switchView("my-account");
            } else {
                this.showToast(result.message || "Registration failed.", "error");
            }
        } catch (err) {
            console.error("Sign up error:", err);
            this.showToast("Error registering account.", "error");
        } finally {
            if (btn) btn.innerHTML = oldHtml;
        }
    }

    handleLogout() {
        this.state.authToken = null;
        this.state.currentUser = null;
        localStorage.removeItem("athena_token");
        localStorage.removeItem("athena_user");
        this.updateAuthUI();
        this.showToast("You have signed out.", "info");
        this.switchView("login");
    }

    switchAccountTab(tabName) {
        this.state.currentAccountTab = tabName;
        ["loans", "history", "settings"].forEach(tab => {
            const tabBtn = document.getElementById(`acc-tab-${tab}`);
            const panel = document.getElementById(`acc-panel-${tab}`);
            if (tab === tabName) {
                tabBtn?.classList.add("active");
                panel?.classList.add("active");
            } else {
                tabBtn?.classList.remove("active");
                panel?.classList.remove("active");
            }
        });
    }

    async refreshAccountData() {
        this.showToast("Refreshing account data...", "info");
        await this.fetchUserProfile();
    }

    async fetchUserProfile() {
        if (!this.state.authToken) {
            this.showToast("Please sign in to view your library account.", "info");
            this.switchView("login");
            return;
        }

        try {
            const res = await fetch("/api/auth/me", {
                headers: { "Authorization": `Bearer ${this.state.authToken}` }
            });
            const result = await res.json();

            if (result.success && result.user) {
                this.state.currentUser = result.user;
                localStorage.setItem("athena_user", JSON.stringify(result.user));
                this.updateAuthUI();
                this.renderUserAccount(result.user);
            } else {
                this.showToast("Session expired. Please sign in again.", "warning");
                this.handleLogout();
            }
        } catch (err) {
            console.error("fetchUserProfile error:", err);
            this.showToast("Error fetching account profile.", "error");
        }
    }

    renderUserAccount(user) {
        // Digital Card
        const cardTier = document.getElementById("myacc-card-tier");
        const cardName = document.getElementById("myacc-card-name");
        const cardEmail = document.getElementById("myacc-card-email");
        const cardCode = document.getElementById("myacc-card-code");

        if (cardTier) cardTier.textContent = user.role === "admin" ? "Chief Librarian" : `${user.tier || 'Member'} Card`;
        if (cardName) cardName.textContent = user.name;
        if (cardEmail) cardEmail.textContent = user.email;
        if (cardCode) cardCode.textContent = user.member_code || "ATHENA-CARD";

        // Profile Info Header Card
        const profAvatar = document.getElementById("myacc-profile-avatar");
        const profName = document.getElementById("myacc-profile-name");
        const roleBadge = document.getElementById("myacc-role-badge");
        const statusBadge = document.getElementById("myacc-status-badge");
        const tierBadge = document.getElementById("myacc-tier-badge");
        const detEmail = document.getElementById("myacc-detail-email");
        const detPhone = document.getElementById("myacc-detail-phone");
        const detCode = document.getElementById("myacc-detail-code");
        const detRole = document.getElementById("myacc-detail-role");

        if (profAvatar) profAvatar.src = user.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";
        if (profName) profName.textContent = user.name;
        if (roleBadge) roleBadge.textContent = user.role === "admin" ? "Administrator" : "Library Member";
        if (statusBadge) statusBadge.textContent = user.status || "Active";
        if (tierBadge) tierBadge.textContent = `${user.tier || 'Standard'} Tier`;
        if (detEmail) detEmail.textContent = user.email;
        if (detPhone) detPhone.textContent = user.phone || "Not set";
        if (detCode) detCode.textContent = user.member_code || "N/A";
        if (detRole) detRole.textContent = user.role === "admin" ? "Chief Librarian (Full Access)" : `${user.tier || 'Student'} Patron`;

        // KPI Metrics
        const activeCount = user.active_loans_count || 0;
        const returnedCount = user.returned_loans_count || 0;
        const fines = user.total_fines_unpaid || 0;
        const maxBooks = user.max_books || (user.tier === "Faculty" ? 10 : 5);

        const kpiActive = document.getElementById("myacc-kpi-active");
        const kpiReturned = document.getElementById("myacc-kpi-returned");
        const kpiFines = document.getElementById("myacc-kpi-fines");
        const finesStatus = document.getElementById("myacc-fines-status");
        const quotaUsed = document.getElementById("myacc-quota-used");
        const quotaMax = document.getElementById("myacc-quota-max");
        const quotaBar = document.getElementById("myacc-quota-bar");
        const loansCounter = document.getElementById("myacc-loans-counter");

        if (kpiActive) kpiActive.textContent = activeCount;
        if (kpiReturned) kpiReturned.textContent = returnedCount;
        if (kpiFines) kpiFines.textContent = `$${fines.toFixed(2)}`;
        if (finesStatus) finesStatus.textContent = fines > 0 ? "Overdue penalty balance due" : "No overdue balance due";
        if (quotaUsed) quotaUsed.textContent = activeCount;
        if (quotaMax) quotaMax.textContent = maxBooks;
        if (loansCounter) loansCounter.textContent = activeCount;

        const quotaPercent = Math.min(100, Math.round((activeCount / maxBooks) * 100));
        if (quotaBar) quotaBar.style.width = `${quotaPercent}%`;

        // Render Active Loans
        const loansContainer = document.getElementById("my-active-loans-list");
        if (loansContainer) {
            const loans = user.activeLoans || [];
            if (loans.length === 0) {
                loansContainer.innerHTML = `
                    <div style="text-align:center; padding: 36px 16px; width:100%; grid-column: 1 / -1;">
                        <i class="fa-solid fa-book-open" style="font-size:2.5rem; color:var(--text-dim); margin-bottom:12px; display:block;"></i>
                        <h4 style="margin-bottom:6px;">No Active Borrowed Books</h4>
                        <p class="text-muted" style="font-size:0.9rem;">You currently do not have any titles checked out from the library.</p>
                        <button class="btn btn-primary mt-3" onclick="app.switchView('catalog')">
                            <i class="fa-solid fa-magnifying-glass"></i> Explore Book Catalog
                        </button>
                    </div>
                `;
            } else {
                loansContainer.innerHTML = loans.map(l => {
                    const isOverdue = l.is_overdue;
                    return `
                        <div class="my-loan-card">
                            <img src="${l.book_cover || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100'}" class="my-loan-cover" alt="Cover">
                            <div class="my-loan-body">
                                <div>
                                    <h4 class="my-loan-title" title="${this.escapeHtml(l.book_title)}">${this.escapeHtml(l.book_title)}</h4>
                                    <div class="my-loan-author">${this.escapeHtml(l.book_author || '')}</div>
                                    <div class="my-loan-dates">
                                        <div><i class="fa-regular fa-calendar"></i> Borrowed: <strong>${l.issue_date}</strong></div>
                                        <div><i class="fa-regular fa-calendar-check"></i> Return Due: <strong class="${isOverdue ? 'text-danger' : 'text-primary'}">${l.due_date}</strong></div>
                                    </div>
                                </div>
                                <div class="my-loan-actions">
                                    <span class="badge ${isOverdue ? 'badge-danger' : 'badge-success'}">
                                        ${isOverdue ? `Overdue (${l.overdue_days}d)` : 'On Loan'}
                                    </span>
                                    <button class="btn btn-xs btn-outline" onclick="app.renewLoanFromAccount(${l.id})" title="Extend loan period by 7 days">
                                        <i class="fa-solid fa-rotate"></i> Renew (+7d)
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join("");
            }
        }

        // Render Borrowing History
        const histTbody = document.getElementById("my-history-tbody");
        if (histTbody) {
            const history = user.borrowingHistory || [];
            if (history.length === 0) {
                histTbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:24px;">No completed circulation records yet.</td></tr>`;
            } else {
                histTbody.innerHTML = history.map(h => `
                    <tr>
                        <td>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <img src="${h.book_cover || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100'}" style="width:30px; height:42px; object-fit:cover; border-radius:4px;">
                                <div>
                                    <strong>${this.escapeHtml(h.book_title)}</strong>
                                    <div style="font-size:0.75rem; color:var(--text-dim);">${this.escapeHtml(h.book_author || '')}</div>
                                </div>
                            </div>
                        </td>
                        <td>${h.issue_date}</td>
                        <td>${h.return_date || '-'}</td>
                        <td><span class="badge badge-success">Returned</span></td>
                        <td><span class="badge badge-outline">Settled</span></td>
                    </tr>
                `).join("");
            }
        }

        // Pre-fill profile settings inputs
        const editName = document.getElementById("profile-name");
        const editPhone = document.getElementById("profile-phone");
        const editAvatar = document.getElementById("profile-avatar");
        if (editName) editName.value = user.name || "";
        if (editPhone) editPhone.value = user.phone || "";
        if (editAvatar) editAvatar.value = user.avatar_url || "";
    }

    async renewLoanFromAccount(txId) {
        try {
            const res = await fetch(`/api/transactions/renew/${txId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ extend_days: 7 })
            });
            const result = await res.json();
            if (result.success) {
                this.showToast(result.message || "Loan renewed for +7 days!", "success");
                await this.fetchUserProfile();
            } else {
                this.showToast(result.message || "Unable to renew loan.", "error");
            }
        } catch (err) {
            this.showToast("Error renewing loan.", "error");
        }
    }

    async handleUpdateProfile(e) {
        e.preventDefault();
        const name = document.getElementById("profile-name")?.value.trim();
        const phone = document.getElementById("profile-phone")?.value.trim();
        const avatar_url = document.getElementById("profile-avatar")?.value.trim();

        try {
            const res = await fetch("/api/auth/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.state.authToken}`
                },
                body: JSON.stringify({ name, phone, avatar_url })
            });
            const result = await res.json();
            if (result.success) {
                this.showToast("Profile updated successfully!", "success");
                await this.fetchUserProfile();
            } else {
                this.showToast(result.message || "Could not update profile.", "error");
            }
        } catch (err) {
            this.showToast("Error saving profile.", "error");
        }
    }

    async handleChangePassword(e) {
        e.preventDefault();
        const current_password = document.getElementById("change-pw-current")?.value;
        const new_password = document.getElementById("change-pw-new")?.value;
        const confirm_password = document.getElementById("change-pw-confirm")?.value;

        if (new_password !== confirm_password) {
            this.showToast("New passwords do not match.", "error");
            return;
        }

        try {
            const res = await fetch("/api/auth/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.state.authToken}`
                },
                body: JSON.stringify({ current_password, new_password })
            });
            const result = await res.json();
            if (result.success) {
                this.showToast("Password updated successfully!", "success");
                document.getElementById("form-change-password")?.reset();
            } else {
                this.showToast(result.message || "Could not update password.", "error");
            }
        } catch (err) {
            this.showToast("Error updating password.", "error");
        }
    }
}

// Global App Instance
const app = new LibraryApp();
