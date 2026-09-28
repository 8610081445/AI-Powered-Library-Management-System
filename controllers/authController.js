const crypto = require("crypto");
const db = require("../config/db");

// Password Hashing Utility
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
    if (!storedHash || !storedHash.includes(":")) {
        return false;
    }
    const [salt, originalHash] = storedHash.split(":");
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return hash === originalHash;
}

// Token generation and verification
function generateToken(user) {
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role || "member",
        member_id: user.member_id || null,
        time: Date.now()
    };
    const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const secret = process.env.JWT_SECRET || "athenalib-super-secure-key-2026";
    const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    return `${data}.${signature}`;
}

function verifyToken(token) {
    if (!token || !token.includes(".")) return null;
    const [data, signature] = token.split(".");
    const secret = process.env.JWT_SECRET || "athenalib-super-secure-key-2026";
    const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    if (signature !== expected) return null;
    try {
        return JSON.parse(Buffer.from(data, "base64url").toString());
    } catch {
        return null;
    }
}

// Helper to extract authenticated user from request header
async function getUserFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }
    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    if (!payload || !payload.id) return null;

    const [users] = await db.query("SELECT * FROM users WHERE id = ?", [payload.id]);
    if (!users || users.length === 0) return null;
    return users[0];
}

// 1. LOGIN
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please enter both email address and password."
            });
        }

        const cleanEmail = email.toLowerCase().trim();
        const [users] = await db.query("SELECT * FROM users WHERE email = ?", [cleanEmail]);

        if (!users || users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password. Please check your credentials."
            });
        }

        const user = users[0];
        const isMatch = verifyPassword(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password. Please check your credentials."
            });
        }

        // Fetch linked member information if member_id exists
        let memberData = null;
        if (user.member_id) {
            const [members] = await db.query("SELECT * FROM members WHERE id = ?", [user.member_id]);
            if (members && members.length > 0) {
                memberData = members[0];
            }
        } else {
            // Also check if a member exists with the same email
            const [membersByEmail] = await db.query("SELECT * FROM members WHERE email = ?", [cleanEmail]);
            if (membersByEmail && membersByEmail.length > 0) {
                memberData = membersByEmail[0];
            }
        }

        // Calculate member loan metrics if linked
        let activeLoansCount = 0;
        let totalFinesUnpaid = 0;
        if (memberData) {
            const [txs] = await db.query("SELECT * FROM transactions WHERE member_id = ?", [memberData.id]);
            if (txs) {
                activeLoansCount = txs.filter(t => t.status === "Issued" || t.status === "Overdue").length;
                totalFinesUnpaid = txs.filter(t => !t.fine_paid).reduce((acc, t) => acc + (parseFloat(t.fine_amount) || 0), 0);
            }
        }

        const token = generateToken(user);

        const safeUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role || "member",
            phone: user.phone || (memberData ? memberData.phone : ""),
            avatar_url: user.avatar_url || (user.role === "admin" 
                ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" 
                : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"),
            member_id: memberData ? memberData.id : null,
            member_code: memberData ? memberData.member_code : "STAFF-001",
            tier: memberData ? memberData.tier : "Staff",
            status: memberData ? memberData.status : "Active",
            max_books: memberData ? memberData.max_books : 25,
            active_loans_count: activeLoansCount,
            total_fines_unpaid: totalFinesUnpaid
        };

        res.json({
            success: true,
            message: `Welcome back, ${user.name}!`,
            token,
            user: safeUser
        });
    } catch (error) {
        next(error);
    }
};

// 2. REGISTER
exports.register = async (req, res, next) => {
    try {
        const { name, email, password, phone, tier, role } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Name is required." });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, message: "Email is required." });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: "Password must be at least 6 characters long." });
        }

        const cleanEmail = email.toLowerCase().trim();

        // Check if user already exists
        const [existingUsers] = await db.query("SELECT * FROM users WHERE email = ?", [cleanEmail]);
        if (existingUsers && existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                message: "An account with this email address already exists. Please sign in instead."
            });
        }

        const userRole = role === "admin" ? "admin" : "member";
        const userTier = tier || "Student";
        const maxBooks = userTier === "Faculty" ? 10 : (userTier === "Scholar" ? 8 : (userTier === "Premium" ? 12 : 5));

        // Create Member Record if role is member
        let memberId = null;
        let memberCode = null;

        if (userRole === "member") {
            const [existingMembers] = await db.query("SELECT * FROM members WHERE email = ?", [cleanEmail]);
            if (existingMembers && existingMembers.length > 0) {
                memberId = existingMembers[0].id;
                memberCode = existingMembers[0].member_code;
            } else {
                memberCode = `MEM-${Math.floor(1000 + Math.random() * 9000)}`;
                const [memResult] = await db.query(
                    `INSERT INTO members (member_code, name, email, phone, tier, status, max_books)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [memberCode, name.trim(), cleanEmail, phone || "", userTier, "Active", maxBooks]
                );
                memberId = memResult.insertId;
            }
        }

        const passwordHash = hashPassword(password);
        const avatarUrl = userRole === "admin"
            ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
            : `https://images.unsplash.com/photo-${1535713875000 + Math.floor(Math.random() * 500)}?w=150&auto=format&fit=crop&q=80`;

        const [userResult] = await db.query(
            `INSERT INTO users (name, email, password_hash, role, member_id, phone, avatar_url)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name.trim(), cleanEmail, passwordHash, userRole, memberId, phone || "", avatarUrl]
        );

        const newUser = {
            id: userResult.insertId,
            name: name.trim(),
            email: cleanEmail,
            role: userRole,
            member_id: memberId,
            phone: phone || "",
            avatar_url: avatarUrl
        };

        const token = generateToken(newUser);

        res.status(201).json({
            success: true,
            message: "Account registered successfully! Welcome to AthenaLib.",
            token,
            user: {
                ...newUser,
                member_code: memberCode || "ADMIN-001",
                tier: userTier,
                status: "Active",
                max_books: maxBooks,
                active_loans_count: 0,
                total_fines_unpaid: 0
            }
        });
    } catch (error) {
        next(error);
    }
};

// 3. GET CURRENT USER & FULL PROFILE (ME)
exports.getMe = async (req, res, next) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required or session expired. Please sign in."
            });
        }

        let memberData = null;
        let memberLoans = [];

        if (user.member_id) {
            const [members] = await db.query("SELECT * FROM members WHERE id = ?", [user.member_id]);
            if (members && members.length > 0) memberData = members[0];
        } else {
            const [members] = await db.query("SELECT * FROM members WHERE email = ?", [user.email]);
            if (members && members.length > 0) memberData = members[0];
        }

        if (memberData) {
            const [loans] = await db.query(
                "SELECT t.*, b.title as book_title, b.author as book_author, b.isbn as book_isbn, b.cover_url as book_cover FROM transactions t JOIN books b ON t.book_id = b.id WHERE t.member_id = ? ORDER BY t.id DESC",
                [memberData.id]
            );
            memberLoans = loans || [];
        }

        const today = new Date();
        const enrichedLoans = memberLoans.map(l => {
            const dueDate = new Date(l.due_date);
            const isOverdue = l.status !== "Returned" && dueDate < today;
            let overdueDays = 0;
            let calculatedFine = parseFloat(l.fine_amount) || 0;

            if (isOverdue) {
                const diffTime = Math.abs(today - dueDate);
                overdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                calculatedFine = Math.max(calculatedFine, overdueDays * 0.50);
            }

            return {
                ...l,
                is_overdue: isOverdue,
                overdue_days: overdueDays,
                calculated_fine: calculatedFine
            };
        });

        const activeLoans = enrichedLoans.filter(l => l.status === "Issued" || l.status === "Overdue");
        const returnedLoans = enrichedLoans.filter(l => l.status === "Returned");
        const totalFinesUnpaid = enrichedLoans
            .filter(l => !l.fine_paid)
            .reduce((sum, l) => sum + (l.calculated_fine || 0), 0);

        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone || (memberData ? memberData.phone : ""),
                avatar_url: user.avatar_url,
                member_id: memberData ? memberData.id : null,
                member_code: memberData ? memberData.member_code : "STAFF-001",
                tier: memberData ? memberData.tier : "Staff",
                status: memberData ? memberData.status : "Active",
                max_books: memberData ? memberData.max_books : 25,
                active_loans_count: activeLoans.length,
                returned_loans_count: returnedLoans.length,
                total_fines_unpaid: totalFinesUnpaid,
                activeLoans,
                borrowingHistory: returnedLoans
            }
        });
    } catch (error) {
        next(error);
    }
};

// 4. UPDATE ACCOUNT PROFILE
exports.updateProfile = async (req, res, next) => {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        const { name, phone, avatar_url, current_password, new_password } = req.body;

        // If user wants to change password
        let newPasswordHash = user.password_hash;
        if (new_password) {
            if (!current_password) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter your current password to set a new password."
                });
            }
            if (!verifyPassword(current_password, user.password_hash)) {
                return res.status(400).json({
                    success: false,
                    message: "Current password is incorrect."
                });
            }
            if (new_password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: "New password must be at least 6 characters long."
                });
            }
            newPasswordHash = hashPassword(new_password);
        }

        const updatedName = name !== undefined ? name.trim() : user.name;
        const updatedPhone = phone !== undefined ? phone : user.phone;
        const updatedAvatar = avatar_url !== undefined ? avatar_url : user.avatar_url;

        await db.query(
            `UPDATE users
             SET name = ?,
                 phone = ?,
                 avatar_url = ?,
                 password_hash = ?
             WHERE id = ?`,
            [updatedName, updatedPhone, updatedAvatar, newPasswordHash, user.id]
        );

        // Also sync name and phone to member table if linked
        if (user.member_id) {
            await db.query(
                `UPDATE members
                 SET name = ?,
                     phone = ?
                 WHERE id = ?`,
                [updatedName, updatedPhone, user.member_id]
            );
        }

        res.json({
            success: true,
            message: "Account profile updated successfully.",
            user: {
                id: user.id,
                name: updatedName,
                email: user.email,
                role: user.role,
                phone: updatedPhone,
                avatar_url: updatedAvatar
            }
        });
    } catch (error) {
        next(error);
    }
};

// 5. LOGOUT
exports.logout = (req, res) => {
    res.json({
        success: true,
        message: "Signed out successfully."
    });
};

module.exports.hashPassword = hashPassword;
module.exports.verifyPassword = verifyPassword;
module.exports.generateToken = generateToken;
module.exports.verifyToken = verifyToken;
