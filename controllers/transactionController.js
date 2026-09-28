const db = require("../config/db");

const DEFAULT_LOAN_DAYS = parseInt(process.env.DEFAULT_LOAN_DAYS, 10) || 14;
const DAILY_FINE_RATE = parseFloat(process.env.DAILY_FINE_RATE) || 0.50;

// 1. Issue Book to Member
exports.issueBook = async (req, res, next) => {
    try {
        const { book_id, member_id, loan_days, notes } = req.body;

        if (!book_id || !member_id) {
            return res.status(400).json({
                success: false,
                message: "Book ID and Member ID are required"
            });
        }

        // Check book existence and availability
        const [books] = await db.query("SELECT * FROM books WHERE id = ?", [book_id]);
        if (!books || books.length === 0) {
            return res.status(404).json({ success: false, message: "Book not found" });
        }
        const book = books[0];
        if (Number(book.available_quantity) <= 0) {
            return res.status(400).json({
                success: false,
                message: "This book is currently out of stock / all copies are issued"
            });
        }

        // Check member existence and borrowing capacity
        const [members] = await db.query("SELECT * FROM members WHERE id = ?", [member_id]);
        if (!members || members.length === 0) {
            return res.status(404).json({ success: false, message: "Member not found" });
        }
        const member = members[0];
        if (member.status !== "Active") {
            return res.status(400).json({
                success: false,
                message: `Member account is ${member.status}. Cannot issue books.`
            });
        }

        // Check active loans count
        const [memberLoans] = await db.query(
            "SELECT * FROM transactions WHERE member_id = ? AND (status = 'Issued' OR status = 'Overdue')",
            [member_id]
        );
        const maxAllowed = member.max_books || 5;
        if (memberLoans && memberLoans.length >= maxAllowed) {
            return res.status(400).json({
                success: false,
                message: `Member has reached maximum borrowing limit (${maxAllowed} books)`
            });
        }

        // Calculate issue date and due date
        const issueDate = new Date();
        const daysToAdd = parseInt(loan_days, 10) || DEFAULT_LOAN_DAYS;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + daysToAdd);

        const issueDateStr = issueDate.toISOString().split("T")[0];
        const dueDateStr = dueDate.toISOString().split("T")[0];

        // Insert transaction
        const [result] = await db.query(
            `INSERT INTO transactions (book_id, member_id, issue_date, due_date, status, fine_amount, fine_paid, notes)
             VALUES (?, ?, ?, ?, 'Issued', 0.00, 0, ?)`,
            [book_id, member_id, issueDateStr, dueDateStr, notes || "Standard loan"]
        );

        // Decrement book availability
        const newAvail = Math.max(0, Number(book.available_quantity) - 1);
        await db.query("UPDATE books SET available_quantity = ? WHERE id = ?", [newAvail, book_id]);

        res.status(201).json({
            success: true,
            message: `"${book.title}" successfully issued to ${member.name}`,
            transactionId: result.insertId,
            due_date: dueDateStr
        });
    } catch (error) {
        next(error);
    }
};

// 2. Return Book
exports.returnBook = async (req, res, next) => {
    try {
        const { transaction_id, notes, waive_fine } = req.body;
        const id = transaction_id || req.params.id;

        if (!id) {
            return res.status(400).json({ success: false, message: "Transaction ID is required" });
        }

        const [txs] = await db.query("SELECT * FROM transactions WHERE id = ?", [id]);
        if (!txs || txs.length === 0) {
            return res.status(404).json({ success: false, message: "Transaction record not found" });
        }

        const tx = txs[0];
        if (tx.status === "Returned") {
            return res.status(400).json({ success: false, message: "This book has already been returned" });
        }

        const returnDate = new Date();
        const returnDateStr = returnDate.toISOString().split("T")[0];
        const dueDate = new Date(tx.due_date);

        // Calculate fine if overdue
        let fineAmount = 0.00;
        const diffTime = returnDate.getTime() - dueDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
            fineAmount = parseFloat((diffDays * DAILY_FINE_RATE).toFixed(2));
        }

        if (waive_fine) {
            fineAmount = 0.00;
        }

        // Update transaction
        await db.query(
            `UPDATE transactions
             SET return_date = ?,
                 status = 'Returned',
                 fine_amount = ?,
                 notes = ?
             WHERE id = ?`,
            [
                returnDateStr,
                fineAmount,
                notes ? `${tx.notes || ''} | ${notes}` : tx.notes,
                id
            ]
        );

        // Restore book available quantity
        const [books] = await db.query("SELECT * FROM books WHERE id = ?", [tx.book_id]);
        if (books && books.length > 0) {
            const book = books[0];
            const newAvail = Math.min(Number(book.quantity), Number(book.available_quantity) + 1);
            await db.query("UPDATE books SET available_quantity = ? WHERE id = ?", [newAvail, tx.book_id]);
        }

        res.json({
            success: true,
            message: "Book successfully returned",
            fine_amount: fineAmount,
            overdue_days: Math.max(0, diffDays)
        });
    } catch (error) {
        next(error);
    }
};

// 3. Renew Loan
exports.renewLoan = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { extend_days } = req.body;

        const [txs] = await db.query("SELECT * FROM transactions WHERE id = ?", [id]);
        if (!txs || txs.length === 0) {
            return res.status(404).json({ success: false, message: "Loan not found" });
        }

        const tx = txs[0];
        if (tx.status === "Returned") {
            return res.status(400).json({ success: false, message: "Cannot renew a returned book" });
        }

        const currentDueDate = new Date(tx.due_date);
        const addDays = parseInt(extend_days, 10) || 7;
        currentDueDate.setDate(currentDueDate.getDate() + addDays);
        const newDueDateStr = currentDueDate.toISOString().split("T")[0];

        await db.query(
            `UPDATE transactions
             SET due_date = ?,
                 status = 'Issued',
                 notes = ?
             WHERE id = ?`,
            [newDueDateStr, `${tx.notes || ''} (Renewed +${addDays}d)`, id]
        );

        res.json({
            success: true,
            message: `Loan extended until ${newDueDateStr}`,
            new_due_date: newDueDateStr
        });
    } catch (error) {
        next(error);
    }
};

// 4. Pay Fine
exports.payFine = async (req, res, next) => {
    try {
        const { id } = req.params;
        await db.query("UPDATE transactions SET fine_paid = 1 WHERE id = ?", [id]);
        res.json({ success: true, message: "Fine marked as paid" });
    } catch (error) {
        next(error);
    }
};

// 5. Get Active / Current Loans
exports.getActiveLoans = async (req, res, next) => {
    try {
        const [loans] = await db.query(
            "SELECT t.*, b.title as book_title, b.author as book_author, b.isbn as book_isbn, b.cover_url as book_cover, m.name as member_name, m.member_code, m.email as member_email, m.phone as member_phone FROM transactions t JOIN books b ON t.book_id = b.id JOIN members m ON t.member_id = m.id WHERE t.status = 'Issued' ORDER BY t.id DESC"
        );

        const today = new Date();
        const enriched = (loans || []).map(l => {
            const dueDate = new Date(l.due_date);
            const isOverdue = today > dueDate;
            let overdueDays = 0;
            let currentFine = 0;

            if (isOverdue) {
                const diffTime = today.getTime() - dueDate.getTime();
                overdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                currentFine = parseFloat((overdueDays * DAILY_FINE_RATE).toFixed(2));
            }

            return {
                ...l,
                is_overdue: isOverdue,
                overdue_days: overdueDays,
                calculated_fine: currentFine
            };
        });

        res.json({
            success: true,
            count: enriched.length,
            data: enriched
        });
    } catch (error) {
        next(error);
    }
};

// 6. Get Full Transaction History
exports.getAllTransactions = async (req, res, next) => {
    try {
        const { status } = req.query;
        let [loans] = await db.query(
            "SELECT t.*, b.title as book_title, b.author as book_author, m.name as member_name, m.member_code FROM transactions t JOIN books b ON t.book_id = b.id JOIN members m ON t.member_id = m.id ORDER BY t.id DESC"
        );

        if (status && status !== "All") {
            loans = loans.filter(l => l.status.toLowerCase() === status.toLowerCase());
        }

        res.json({
            success: true,
            count: loans.length,
            data: loans
        });
    } catch (error) {
        next(error);
    }
};
