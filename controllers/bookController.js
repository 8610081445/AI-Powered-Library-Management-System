const db = require("../config/db");

// 1. Get all books with optional search, category, availability filter and sorting
exports.getBooks = async (req, res, next) => {
    try {
        const { search, category, available, sort } = req.query;
        let [books] = await db.query("SELECT * FROM books ORDER BY id DESC");

        if (category && category !== "All") {
            books = books.filter(b => b.category && b.category.toLowerCase() === category.toLowerCase());
        }

        if (available === "true") {
            books = books.filter(b => Number(b.available_quantity) > 0);
        } else if (available === "false") {
            books = books.filter(b => Number(b.available_quantity) === 0);
        }

        if (search && search.trim()) {
            const q = search.toLowerCase().trim();
            books = books.filter(b =>
                (b.title && b.title.toLowerCase().includes(q)) ||
                (b.author && b.author.toLowerCase().includes(q)) ||
                (b.category && b.category.toLowerCase().includes(q)) ||
                (b.isbn && b.isbn.toLowerCase().includes(q)) ||
                (b.tags && b.tags.toLowerCase().includes(q))
            );
        }

        if (sort) {
            if (sort === "rating_desc") {
                books.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
            } else if (sort === "title_asc") {
                books.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
            } else if (sort === "year_desc") {
                books.sort((a, b) => Number(b.published_year || 0) - Number(a.published_year || 0));
            } else if (sort === "quantity_desc") {
                books.sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));
            }
        }

        res.json({
            success: true,
            count: books.length,
            data: books
        });
    } catch (error) {
        next(error);
    }
};

// 2. Get Book by ID
exports.getBookById = async (req, res, next) => {
    try {
        const [books] = await db.query(
            "SELECT * FROM books WHERE id = ?",
            [req.params.id]
        );

        if (!books || books.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Book not found"
            });
        }

        // Also fetch active loan count for this book
        const [transactions] = await db.query(
            "SELECT t.*, m.name as member_name, m.member_code FROM transactions t JOIN books b ON t.book_id = b.id JOIN members m ON t.member_id = m.id WHERE t.book_id = ? ORDER BY t.id DESC",
            [req.params.id]
        );

        res.json({
            success: true,
            data: {
                ...books[0],
                recentLoans: transactions || []
            }
        });
    } catch (error) {
        next(error);
    }
};

// 3. Create Book
exports.createBook = async (req, res, next) => {
    try {
        const {
            title,
            author,
            category,
            isbn,
            quantity,
            description,
            cover_url,
            rating,
            published_year,
            tags
        } = req.body;

        if (!title || !author) {
            return res.status(400).json({
                success: false,
                message: "Title and author are required"
            });
        }

        const qty = parseInt(quantity, 10) || 1;
        const generatedIsbn = isbn || `978-${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        const cover = cover_url || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=80";

        const [result] = await db.query(
            `INSERT INTO books
            (title, author, category, isbn, quantity, available_quantity, description, cover_url, rating, published_year, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title.trim(),
                author.trim(),
                category || "General",
                generatedIsbn,
                qty,
                qty,
                description || "",
                cover,
                parseFloat(rating) || 4.5,
                parseInt(published_year, 10) || new Date().getFullYear(),
                tags || ""
            ]
        );

        res.status(201).json({
            success: true,
            message: "Book added to catalog successfully",
            bookId: result.insertId
        });
    } catch (error) {
        next(error);
    }
};

// 4. Update Book
exports.updateBook = async (req, res, next) => {
    try {
        const { title, author, category, quantity, description, cover_url, rating, published_year, tags } = req.body;

        const [existing] = await db.query("SELECT * FROM books WHERE id = ?", [req.params.id]);
        if (!existing || existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Book not found"
            });
        }

        const book = existing[0];
        const newQty = quantity !== undefined ? parseInt(quantity, 10) : book.quantity;
        const diff = newQty - book.quantity;
        const newAvail = Math.max(0, (book.available_quantity || 0) + diff);

        const [result] = await db.query(
            `UPDATE books
             SET title = ?,
                 author = ?,
                 category = ?,
                 quantity = ?,
                 available_quantity = ?,
                 description = ?,
                 cover_url = ?,
                 rating = ?,
                 published_year = ?,
                 tags = ?
             WHERE id = ?`,
            [
                title !== undefined ? title : book.title,
                author !== undefined ? author : book.author,
                category !== undefined ? category : book.category,
                newQty,
                newAvail,
                description !== undefined ? description : book.description,
                cover_url !== undefined ? cover_url : book.cover_url,
                rating !== undefined ? parseFloat(rating) : book.rating,
                published_year !== undefined ? parseInt(published_year, 10) : book.published_year,
                tags !== undefined ? tags : book.tags,
                req.params.id
            ]
        );

        res.json({
            success: true,
            message: "Book updated successfully"
        });
    } catch (error) {
        next(error);
    }
};

// 5. Delete Book
exports.deleteBook = async (req, res, next) => {
    try {
        // Check if book has active loans
        const [activeLoans] = await db.query(
            "SELECT * FROM transactions WHERE book_id = ? AND status = 'Issued'",
            [req.params.id]
        );

        if (activeLoans && activeLoans.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete book because copies are currently issued to members."
            });
        }

        const [result] = await db.query(
            "DELETE FROM books WHERE id = ?",
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Book not found"
            });
        }

        res.json({
            success: true,
            message: "Book deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};

// 6. Get Categories & Stats
exports.getCategories = async (req, res, next) => {
    try {
        const [books] = await db.query("SELECT category FROM books");
        const counts = {};
        (books || []).forEach(b => {
            const cat = b.category || "Uncategorized";
            counts[cat] = (counts[cat] || 0) + 1;
        });

        res.json({
            success: true,
            data: counts
        });
    } catch (error) {
        next(error);
    }
};
