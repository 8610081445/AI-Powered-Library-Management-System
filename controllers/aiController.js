const db = require("../config/db");
const https = require("https");

const STOP_WORDS = new Set([
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing",
    "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
    "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself",
    "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is",
    "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves",
    "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so",
    "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there",
    "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to",
    "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's",
    "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've",
    "your", "yours", "yourself", "yourselves", "book", "books", "read", "reading", "want", "like", "find"
]);

function extractKeywords(text) {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// 1. Semantic Book Search
exports.semanticSearch = async (req, res, next) => {
    try {
        const { query } = req.body;
        if (!query || !query.trim()) {
            return res.status(400).json({ success: false, message: "Search query is required" });
        }

        const [books] = await db.query("SELECT * FROM books");
        const queryWords = extractKeywords(query);

        if (queryWords.length === 0) {
            return res.json({ success: true, count: books.length, data: books });
        }

        // Score books by semantic and keyword relevance
        const scoredBooks = (books || []).map(b => {
            const titleWords = extractKeywords(b.title);
            const authorWords = extractKeywords(b.author);
            const categoryWords = extractKeywords(b.category);
            const descWords = extractKeywords(b.description);
            const tagWords = extractKeywords(b.tags);

            let score = 0;
            const matchedFeatures = [];

            queryWords.forEach(word => {
                // Exact or substring match in Title (heavy weight)
                if (titleWords.some(tw => tw.includes(word) || word.includes(tw))) {
                    score += 40;
                    if (!matchedFeatures.includes("Title")) matchedFeatures.push("Title");
                }
                // Category match
                if (categoryWords.some(cw => cw.includes(word) || word.includes(cw))) {
                    score += 30;
                    if (!matchedFeatures.includes("Category")) matchedFeatures.push("Category");
                }
                // Tags match
                if (tagWords.some(tw => tw.includes(word) || word.includes(tw))) {
                    score += 25;
                    if (!matchedFeatures.includes("Key Tags")) matchedFeatures.push("Key Tags");
                }
                // Description match
                if (descWords.some(dw => dw.includes(word) || word.includes(dw))) {
                    score += 15;
                    if (!matchedFeatures.includes("Synopsis")) matchedFeatures.push("Synopsis");
                }
                // Author match
                if (authorWords.some(aw => aw.includes(word) || word.includes(aw))) {
                    score += 35;
                    if (!matchedFeatures.includes("Author")) matchedFeatures.push("Author");
                }
            });

            // Normalized confidence score (0 to 99%)
            const maxPossible = queryWords.length * 50;
            const confidence = Math.min(99, Math.round((score / maxPossible) * 100));

            return {
                ...b,
                semantic_score: confidence,
                match_reasons: matchedFeatures.length > 0 ? matchedFeatures : ["Thematic Similarity"]
            };
        });

        // Filter items with positive score, sort by score descending
        const results = scoredBooks
            .filter(b => b.semantic_score > 0)
            .sort((a, b) => b.semantic_score - a.semantic_score);

        // Fallback if no specific matches found
        const finalResults = results.length > 0 ? results : books.slice(0, 4).map(b => ({
            ...b,
            semantic_score: 50,
            match_reasons: ["Curated Library Pick"]
        }));

        res.json({
            success: true,
            count: finalResults.length,
            query,
            data: finalResults
        });
    } catch (error) {
        next(error);
    }
};

// 2. AI Book Summarizer & Key Insights
exports.summarizeBook = async (req, res, next) => {
    try {
        const { book_id } = req.body;
        if (!book_id) {
            return res.status(400).json({ success: false, message: "Book ID is required" });
        }

        const [books] = await db.query("SELECT * FROM books WHERE id = ?", [book_id]);
        if (!books || books.length === 0) {
            return res.status(404).json({ success: false, message: "Book not found" });
        }

        const book = books[0];

        // Synthesize structured AI analysis
        const tags = (book.tags || "").split(",").map(t => t.trim()).filter(Boolean);
        let difficulty = "Intermediate";
        let readTime = "7 - 9 hours";
        let targetAudience = "Enthusiasts & Lifelong Learners";

        if (book.category === "Artificial Intelligence" || book.category === "Computer Science") {
            difficulty = book.title.toLowerCase().includes("introduction") || book.title.toLowerCase().includes("clean") ? "Beginner to Intermediate" : "Advanced / Technical";
            readTime = "12 - 16 hours (Deep Study)";
            targetAudience = "Software Engineers, Researchers, and Computer Science Students";
        } else if (book.category === "Science Fiction") {
            difficulty = "Accessible";
            readTime = "6 - 8 hours";
            targetAudience = "Sci-Fi Lovers, Speculative Fiction Readers, Worldbuilding Fans";
        } else if (book.category === "Psychology" || book.category === "Personal Development") {
            difficulty = "Accessible / Practical";
            readTime = "5 - 7 hours";
            targetAudience = "Professionals, Leaders, Self-Improvement Seekers";
        }

        const keyTakeaways = [
            `Foundational Core Concept: Explores how ${book.category.toLowerCase()} shapes modern perspectives and everyday systems through the lens of ${book.author}'s research.`,
            `Actionable / Thematic Insight: Deconstructs complex nuances into structured paradigms (${tags.slice(0, 3).join(", ") || "fundamental principles"}).`,
            `Critical Relevance: Remains a seminal benchmark work that provides enduring frameworks for both beginners and seasoned specialists.`
        ];

        const summary = {
            title: book.title,
            author: book.author,
            category: book.category,
            isbn: book.isbn,
            rating: book.rating,
            synopsis: book.description,
            difficulty,
            estimated_reading_time: readTime,
            target_audience: targetAudience,
            key_takeaways: keyTakeaways,
            thematic_keywords: tags.length > 0 ? tags : ["Theory", "Practice", "Application", "Innovation"],
            ai_recommendation_verdict: `Highly Recommended (Score: ${Math.round((book.rating || 4.5) * 20)}/100) for anyone interested in deep domain mastery.`
        };

        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        next(error);
    }
};

// 3. Personalized Book Recommendations
exports.getRecommendations = async (req, res, next) => {
    try {
        const { member_id } = req.body;
        const [books] = await db.query("SELECT * FROM books");
        let preferredCategories = [];

        if (member_id) {
            const [loans] = await db.query(
                "SELECT t.*, b.category FROM transactions t JOIN books b ON t.book_id = b.id WHERE t.member_id = ?",
                [member_id]
            );
            if (loans && loans.length > 0) {
                const catCounts = {};
                loans.forEach(l => {
                    if (l.category) {
                        catCounts[l.category] = (catCounts[l.category] || 0) + 1;
                    }
                });
                preferredCategories = Object.keys(catCounts).sort((a, b) => catCounts[b] - catCounts[a]);
            }
        }

        if (preferredCategories.length === 0) {
            preferredCategories = ["Artificial Intelligence", "Computer Science", "Science Fiction"];
        }

        const recommendations = (books || [])
            .map(b => {
                let affinity = 70;
                let reason = "Popular trending read in our library";

                if (preferredCategories.includes(b.category)) {
                    affinity = 90 + Math.floor(Math.random() * 8);
                    reason = `Matches your interest in ${b.category}`;
                } else if (Number(b.rating) >= 4.8) {
                    affinity = 88;
                    reason = `Top-rated critical acclaim (${b.rating} ★)`;
                }

                return {
                    ...b,
                    match_percentage: affinity,
                    recommendation_reason: reason
                };
            })
            .sort((a, b) => b.match_percentage - a.match_percentage)
            .slice(0, 6);

        res.json({
            success: true,
            count: recommendations.length,
            data: recommendations
        });
    } catch (error) {
        next(error);
    }
};

// 4. Interactive AI Librarian Assistant ("Athena AI")
exports.chatAssistant = async (req, res, next) => {
    try {
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: "User message is required" });
        }

        const userMsg = message.toLowerCase().trim();
        const [books] = await db.query("SELECT * FROM books");
        const [members] = await db.query("SELECT * FROM members");
        const [loans] = await db.query("SELECT * FROM transactions WHERE status = 'Issued'");

        let reply = "";
        let suggestedActions = [];

        // Check if user is asking for books on a topic
        const matchedCategory = (books || []).find(b => userMsg.includes(b.category.toLowerCase()));
        const matchedBook = (books || []).find(b => userMsg.includes(b.title.toLowerCase()) || b.title.toLowerCase().split(":")[0].trim() === userMsg);

        if (matchedBook) {
            const isAvail = Number(matchedBook.available_quantity) > 0;
            reply = `**${matchedBook.title}** by ${matchedBook.author} is currently in our collection! ` +
                `\n\n- **Status**: ${isAvail ? `✅ Available (${matchedBook.available_quantity} copies)` : "❌ All copies currently borrowed"} ` +
                `\n- **Category**: ${matchedBook.category} ` +
                `\n- **ISBN**: ${matchedBook.isbn} ` +
                `\n- **Rating**: ${matchedBook.rating} ★ ` +
                `\n\n*Synopsis*: ${matchedBook.description.substring(0, 200)}...`;
            suggestedActions = isAvail ? [`Issue "${matchedBook.title}"`, "Find similar titles"] : ["Notify when available", "Explore other titles in " + matchedBook.category];
        } else if (userMsg.includes("recommend") || userMsg.includes("suggest") || userMsg.includes("what should i read")) {
            const topRated = [...(books || [])].sort((a, b) => Number(b.rating) - Number(a.rating)).slice(0, 3);
            reply = `Here are 3 exceptional recommendations from our catalog:\n\n` +
                topRated.map((b, i) => `${i + 1}. **${b.title}** by ${b.author} (${b.category} • ${b.rating} ★)\n   *"${b.description.substring(0, 110)}..."*`).join("\n\n") +
                `\n\nWould you like me to check real-time availability or reserve any of these for you?`;
            suggestedActions = ["Show Artificial Intelligence books", "Show Science Fiction books", "View Circulation Rules"];
        } else if (userMsg.includes("ai") || userMsg.includes("artificial intelligence") || userMsg.includes("machine learning")) {
            const aiBooks = (books || []).filter(b => b.category === "Artificial Intelligence");
            reply = `We have **${aiBooks.length} titles** in our Artificial Intelligence collection:\n\n` +
                aiBooks.map(b => `• **${b.title}** by ${b.author} (${b.available_quantity > 0 ? `${b.available_quantity} available` : 'Issued'})`).join("\n") +
                `\n\nTip: *Russell & Norvig's 'Artificial Intelligence: A Modern Approach'* is our most requested reference text.`;
            suggestedActions = ["View AI Books in Catalog", "Summarize Deep Learning"];
        } else if (userMsg.includes("fine") || userMsg.includes("overdue") || userMsg.includes("late fee")) {
            reply = `📚 **Library Overdue & Fine Policy**:\n\n` +
                `• **Standard Loan Period**: 14 days (Faculty: up to 30 days).\n` +
                `• **Daily Fine Rate**: $0.50 per day past the due date.\n` +
                `• **Renewal**: You can renew any active loan for an additional 7 or 14 days from the Circulation tab, provided no pending holds exist.\n` +
                `• **Fine Payment**: Overdue fines can be settled at check-in or marked as cleared in the Circulation dashboard.`;
            suggestedActions = ["View Active Loans", "Check Overdue Books"];
        } else if (userMsg.includes("hour") || userMsg.includes("open") || userMsg.includes("time")) {
            reply = `🏛️ **Library Operating Hours**:\n\n` +
                `• **Monday – Friday**: 8:00 AM – 10:00 PM\n` +
                `• **Saturday**: 9:00 AM – 8:00 PM\n` +
                `• **Sunday**: 10:00 AM – 6:00 PM\n` +
                `• **Digital Catalog & AI Hub**: Available 24/7 online!`;
            suggestedActions = ["Browse Catalog", "Explore AI Hub"];
        } else if (userMsg.includes("member") || userMsg.includes("register") || userMsg.includes("card") || userMsg.includes("limit")) {
            reply = `👥 **Membership Information**:\n\n` +
                `• **Students**: Up to 5 concurrent loans.\n` +
                `• **Faculty**: Up to 10 concurrent loans.\n` +
                `• **Scholars & Premium Members**: Up to 8–12 concurrent loans.\n` +
                `We currently have **${members.length} registered members** actively using the library.`;
            suggestedActions = ["Register New Member", "View All Members"];
        } else if (userMsg.includes("hello") || userMsg.includes("hi") || userMsg.includes("hey")) {
            reply = `Hello! 👋 I'm **Athena**, your AI-Powered Library Assistant.\n\n` +
                `I can assist you with:\n` +
                `• Finding books by topic, mood, or natural description\n` +
                `• Real-time stock and availability checks\n` +
                `• Generating instant AI book summaries & key insights\n` +
                `• Library loan policies, renewals, and overdue calculations\n\n` +
                `What can I help you find today?`;
            suggestedActions = ["Recommend a top book", "Check AI collection", "Find clean coding guides"];
        } else {
            // General semantic match reply
            const keywords = extractKeywords(userMsg);
            const matches = (books || []).filter(b => {
                const text = `${b.title} ${b.category} ${b.tags} ${b.description}`.toLowerCase();
                return keywords.some(k => text.includes(k));
            }).slice(0, 3);

            if (matches.length > 0) {
                reply = `Based on your request, here are relevant titles from our collection:\n\n` +
                    matches.map(b => `• **${b.title}** by ${b.author} (${b.category})\n  *${b.description.substring(0, 100)}...*`).join("\n\n") +
                    `\n\nWould you like more details or an AI summary for any of these?`;
                suggestedActions = matches.map(m => `Summarize "${m.title.substring(0, 25)}"`);
            } else {
                reply = `I searched our catalog and policies for "${message}". We currently have **${books.length} titles** across AI, Computer Science, Sci-Fi, Psychology, and History.\n\nTry asking me for a genre, an author, or a concept (like "recommend something about distributed systems" or "are there books on neural networks?").`;
                suggestedActions = ["Top Rated Books", "Artificial Intelligence", "Science Fiction"];
            }
        }

        res.json({
            success: true,
            reply,
            suggestedActions,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    } catch (error) {
        next(error);
    }
};

// 5. AI Auto-Cataloger (Generates metadata from title/author)
exports.autoCatalog = async (req, res, next) => {
    try {
        const { title, author } = req.body;
        if (!title) {
            return res.status(400).json({ success: false, message: "Title is required for auto-cataloging" });
        }

        const t = title.toLowerCase();
        let category = "General";
        let tags = "Book, Literature";
        let generatedDescription = `An insightful work by ${author || "the author"} examining core principles, systematic frameworks, and deep thematic explorations.`;

        if (t.includes("ai") || t.includes("artificial intelligence") || t.includes("deep learning") || t.includes("neural") || t.includes("machine learning")) {
            category = "Artificial Intelligence";
            tags = "AI, Machine Learning, Neural Networks, Computer Science, Algorithms";
            generatedDescription = `Comprehensive study on modern artificial intelligence paradigms, algorithmic structures, and computational models authored by ${author || "leading practitioners"}.`;
        } else if (t.includes("code") || t.includes("programming") || t.includes("data") || t.includes("algorithm") || t.includes("architecture") || t.includes("software")) {
            category = "Computer Science";
            tags = "Software Engineering, Architecture, Programming, Data Systems";
            generatedDescription = `Essential reference guide focusing on clean software architecture, robust engineering practices, and reliable computing systems.`;
        } else if (t.includes("space") || t.includes("alien") || t.includes("future") || t.includes("star") || t.includes("galaxy") || t.includes("cyber")) {
            category = "Science Fiction";
            tags = "Sci-Fi, Speculative Fiction, Future, Technology, Dystopian";
            generatedDescription = `Visionary science-fiction narrative exploring futuristic civilizations, cosmic dilemmas, and technological frontiers.`;
        } else if (t.includes("habit") || t.includes("think") || t.includes("mind") || t.includes("psychology") || t.includes("brain")) {
            category = "Psychology";
            tags = "Psychology, Behavioral Science, Mental Models, Decision Making";
            generatedDescription = `Empirical investigation into human cognition, behavioral mechanics, decision heuristics, and personal mastery.`;
        }

        res.json({
            success: true,
            data: {
                category,
                tags,
                description: generatedDescription,
                rating: 4.7,
                published_year: new Date().getFullYear(),
                isbn: `978-${Math.floor(1000000000 + Math.random() * 9000000000)}`
            }
        });
    } catch (error) {
        next(error);
    }
};
