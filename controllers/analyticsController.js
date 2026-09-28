const db = require("../config/db");

exports.getDashboardStats = async (req, res, next) => {
    try {
        const [books] = await db.query("SELECT * FROM books");
        const [members] = await db.query("SELECT * FROM members");
        const [transactions] = await db.query("SELECT * FROM transactions");

        const allBooks = books || [];
        const allMembers = members || [];
        const allTxs = transactions || [];

        // Inventory metrics
        const totalTitles = allBooks.length;
        const totalCopies = allBooks.reduce((sum, b) => sum + (parseInt(b.quantity, 10) || 0), 0);
        const availableCopies = allBooks.reduce((sum, b) => sum + (parseInt(b.available_quantity, 10) || 0), 0);
        const issuedCopies = Math.max(0, totalCopies - availableCopies);

        // Loans metrics
        const today = new Date();
        const activeLoans = allTxs.filter(t => t.status === "Issued");
        const returnedLoans = allTxs.filter(t => t.status === "Returned");
        const overdueLoans = allTxs.filter(t => {
            if (t.status === "Overdue") return true;
            if (t.status === "Issued" && t.due_date) {
                return today > new Date(t.due_date);
            }
            return false;
        });

        // Fines metrics
        const totalFines = allTxs.reduce((sum, t) => sum + (parseFloat(t.fine_amount) || 0), 0);
        const collectedFines = allTxs
            .filter(t => t.fine_paid)
            .reduce((sum, t) => sum + (parseFloat(t.fine_amount) || 0), 0);
        const pendingFines = totalFines - collectedFines;

        // Category breakdown
        const categoryCounts = {};
        allBooks.forEach(b => {
            const cat = b.category || "Uncategorized";
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });

        // Most borrowed books
        const bookBorrowCounts = {};
        allTxs.forEach(t => {
            bookBorrowCounts[t.book_id] = (bookBorrowCounts[t.book_id] || 0) + 1;
        });

        const topBooks = Object.entries(bookBorrowCounts)
            .map(([bookId, count]) => {
                const b = allBooks.find(item => Number(item.id) === Number(bookId));
                return {
                    id: bookId,
                    title: b ? b.title : "Unknown Title",
                    author: b ? b.author : "",
                    cover_url: b ? b.cover_url : "",
                    borrow_count: count
                };
            })
            .sort((a, b) => b.borrow_count - a.borrow_count)
            .slice(0, 5);

        // Recent Activity Feed
        const recentActivity = [...allTxs]
            .sort((a, b) => Number(b.id) - Number(a.id))
            .slice(0, 7)
            .map(t => {
                const b = allBooks.find(item => Number(item.id) === Number(t.book_id));
                const m = allMembers.find(mem => Number(mem.id) === Number(t.member_id));
                return {
                    id: t.id,
                    type: t.status === "Returned" ? "return" : (today > new Date(t.due_date) ? "overdue" : "issue"),
                    bookTitle: b ? b.title : "Book",
                    memberName: m ? m.name : "Member",
                    date: t.return_date || t.issue_date,
                    status: t.status
                };
            });

        res.json({
            success: true,
            data: {
                kpis: {
                    totalTitles,
                    totalCopies,
                    availableCopies,
                    issuedCopies,
                    totalMembers: allMembers.length,
                    activeLoans: activeLoans.length,
                    overdueLoans: overdueLoans.length,
                    totalFines: totalFines.toFixed(2),
                    collectedFines: collectedFines.toFixed(2),
                    pendingFines: pendingFines.toFixed(2),
                    returnRate: allTxs.length > 0 ? Math.round((returnedLoans.length / allTxs.length) * 100) : 100
                },
                categoryBreakdown: categoryCounts,
                topBooks,
                recentActivity,
                engineInfo: db.getEngine()
            }
        });
    } catch (error) {
        next(error);
    }
};
