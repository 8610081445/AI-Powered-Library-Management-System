const db = require("../config/db");

// 1. Get all members
exports.getMembers = async (req, res, next) => {
    try {
        const { search, tier, status } = req.query;
        let [members] = await db.query("SELECT * FROM members ORDER BY id DESC");

        if (tier && tier !== "All") {
            members = members.filter(m => m.tier && m.tier.toLowerCase() === tier.toLowerCase());
        }

        if (status && status !== "All") {
            members = members.filter(m => m.status && m.status.toLowerCase() === status.toLowerCase());
        }

        if (search && search.trim()) {
            const q = search.toLowerCase().trim();
            members = members.filter(m =>
                (m.name && m.name.toLowerCase().includes(q)) ||
                (m.member_code && m.member_code.toLowerCase().includes(q)) ||
                (m.email && m.email.toLowerCase().includes(q)) ||
                (m.phone && m.phone.toLowerCase().includes(q))
            );
        }

        // Augment with active loans count and unpaid fines
        const [transactions] = await db.query("SELECT * FROM transactions");
        const enriched = members.map(m => {
            const memberLoans = (transactions || []).filter(t => Number(t.member_id) === Number(m.id));
            const activeLoans = memberLoans.filter(t => t.status === "Issued" || t.status === "Overdue").length;
            const totalFines = memberLoans
                .filter(t => !t.fine_paid)
                .reduce((sum, t) => sum + (parseFloat(t.fine_amount) || 0), 0);

            return {
                ...m,
                active_loans_count: activeLoans,
                total_fines_unpaid: totalFines
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

// 2. Get member by ID with loan history
exports.getMemberById = async (req, res, next) => {
    try {
        const [members] = await db.query("SELECT * FROM members WHERE id = ?", [req.params.id]);
        if (!members || members.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        const member = members[0];
        const [loans] = await db.query(
            "SELECT t.*, b.title as book_title, b.author as book_author, b.cover_url as book_cover FROM transactions t JOIN books b ON t.book_id = b.id JOIN members m ON t.member_id = m.id WHERE t.member_id = ? ORDER BY t.id DESC",
            [req.params.id]
        );

        const activeLoans = (loans || []).filter(l => l.status === "Issued" || l.status === "Overdue");
        const totalFines = (loans || [])
            .filter(l => !l.fine_paid)
            .reduce((sum, l) => sum + (parseFloat(l.fine_amount) || 0), 0);

        res.json({
            success: true,
            data: {
                ...member,
                active_loans_count: activeLoans.length,
                total_fines_unpaid: totalFines,
                loans: loans || []
            }
        });
    } catch (error) {
        next(error);
    }
};

// 3. Register Member
exports.createMember = async (req, res, next) => {
    try {
        const { name, email, phone, tier, status, max_books } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: "Name and email are required"
            });
        }

        // Check if email already exists
        const [existing] = await db.query("SELECT * FROM members WHERE email = ?", [email.trim()]);
        if (existing && existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: "A member with this email already exists"
            });
        }

        const memberCode = `MEM-${Math.floor(1000 + Math.random() * 9000)}`;
        const userTier = tier || "Student";
        const maxAllowed = max_books || (userTier === "Faculty" ? 10 : (userTier === "Scholar" ? 8 : 5));

        const [result] = await db.query(
            `INSERT INTO members (member_code, name, email, phone, tier, status, max_books)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                memberCode,
                name.trim(),
                email.trim(),
                phone || "",
                userTier,
                status || "Active",
                maxAllowed
            ]
        );

        res.status(201).json({
            success: true,
            message: "Member registered successfully",
            memberId: result.insertId,
            memberCode
        });
    } catch (error) {
        next(error);
    }
};

// 4. Update Member
exports.updateMember = async (req, res, next) => {
    try {
        const { name, email, phone, tier, status, max_books } = req.body;

        const [existing] = await db.query("SELECT * FROM members WHERE id = ?", [req.params.id]);
        if (!existing || existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        const m = existing[0];
        const [result] = await db.query(
            `UPDATE members
             SET name = ?,
                 email = ?,
                 phone = ?,
                 tier = ?,
                 status = ?,
                 max_books = ?
             WHERE id = ?`,
            [
                name !== undefined ? name.trim() : m.name,
                email !== undefined ? email.trim() : m.email,
                phone !== undefined ? phone : m.phone,
                tier !== undefined ? tier : m.tier,
                status !== undefined ? status : m.status,
                max_books !== undefined ? parseInt(max_books, 10) : m.max_books,
                req.params.id
            ]
        );

        res.json({
            success: true,
            message: "Member updated successfully"
        });
    } catch (error) {
        next(error);
    }
};

// 5. Delete Member
exports.deleteMember = async (req, res, next) => {
    try {
        // Check active loans
        const [activeLoans] = await db.query(
            "SELECT * FROM transactions WHERE member_id = ? AND status = 'Issued'",
            [req.params.id]
        );

        if (activeLoans && activeLoans.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot remove member with active borrowed books."
            });
        }

        const [result] = await db.query("DELETE FROM members WHERE id = ?", [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        res.json({
            success: true,
            message: "Member deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};
