const db = require("../config/db");
const { hashPassword } = require("../controllers/authController");

const sampleBooks = [
    {
        title: "Artificial Intelligence: A Modern Approach",
        author: "Stuart Russell & Peter Norvig",
        category: "Artificial Intelligence",
        isbn: "978-0134610993",
        quantity: 5,
        available_quantity: 4,
        description: "The authoritative, comprehensive introduction to the theory and practice of artificial intelligence. Covers probabilistic reasoning, machine learning, neural networks, and robotics.",
        cover_url: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=500&auto=format&fit=crop&q=80",
        rating: 4.9,
        published_year: 2020,
        tags: "AI, Machine Learning, Computer Science, Algorithms, Robotics"
    },
    {
        title: "Deep Learning",
        author: "Ian Goodfellow, Yoshua Bengio & Aaron Courville",
        category: "Artificial Intelligence",
        isbn: "978-0262035613",
        quantity: 4,
        available_quantity: 3,
        description: "Written by three experts in the field, this is the definitive textbook on deep learning covering mathematical fundamentals, deep feedforward networks, convolution, and generative modeling.",
        cover_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80",
        rating: 4.8,
        published_year: 2016,
        tags: "Deep Learning, Neural Networks, Math, Computer Vision"
    },
    {
        title: "Clean Code: A Handbook of Agile Software Craftsmanship",
        author: "Robert C. Martin",
        category: "Computer Science",
        isbn: "978-0132350884",
        quantity: 6,
        available_quantity: 4,
        description: "Even bad code can function. But if code isn't clean, it can bring a development organization to its knees. Learn meaningful naming, function design, refactoring, and unit testing.",
        cover_url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&auto=format&fit=crop&q=80",
        rating: 4.7,
        published_year: 2008,
        tags: "Software Engineering, Best Practices, Refactoring, Architecture"
    },
    {
        title: "Designing Data-Intensive Applications",
        author: "Martin Kleppmann",
        category: "Computer Science",
        isbn: "978-1449373320",
        quantity: 5,
        available_quantity: 5,
        description: "The indispensable guide to the principles, algorithms, and practical trade-offs involved in building data systems that are reliable, scalable, and maintainable.",
        cover_url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=500&auto=format&fit=crop&q=80",
        rating: 4.9,
        published_year: 2017,
        tags: "Distributed Systems, Databases, Architecture, Kafka, Scalability"
    },
    {
        title: "The Pragmatic Programmer",
        author: "David Thomas & Andrew Hunt",
        category: "Computer Science",
        isbn: "978-0135957059",
        quantity: 4,
        available_quantity: 3,
        description: "Filled with practical advice, analogies, and wisdom, this classic book guides programmers through career development, problem-solving, and building enduring code.",
        cover_url: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=500&auto=format&fit=crop&q=80",
        rating: 4.8,
        published_year: 2019,
        tags: "Programming, Career, Best Practices, Tooling"
    },
    {
        title: "Dune",
        author: "Frank Herbert",
        category: "Science Fiction",
        isbn: "978-0441172719",
        quantity: 6,
        available_quantity: 4,
        description: "Set on the desert planet Arrakis, Dune tells the story of Paul Atreides as his noble family assumes control of the universe's most coveted substance: the spice melange.",
        cover_url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80",
        rating: 4.9,
        published_year: 1965,
        tags: "Sci-Fi, Space Opera, Politics, Ecology, Desert"
    },
    {
        title: "The Three-Body Problem",
        author: "Cixin Liu",
        category: "Science Fiction",
        isbn: "978-0765382030",
        quantity: 5,
        available_quantity: 4,
        description: "Set against the backdrop of China's Cultural Revolution, a secret military project sends signals into space, contacting an alien civilization on the brink of destruction.",
        cover_url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80",
        rating: 4.7,
        published_year: 2014,
        tags: "Hard Sci-Fi, Aliens, Physics, Astronomy"
    },
    {
        title: "Neuromancer",
        author: "William Gibson",
        category: "Science Fiction",
        isbn: "978-0441569595",
        quantity: 4,
        available_quantity: 4,
        description: "The seminal cyberpunk novel that coined the term 'cyberspace' and influenced generations of writers and technologists with its depiction of cyberspace cowboys and mega-corporations.",
        cover_url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&auto=format&fit=crop&q=80",
        rating: 4.6,
        published_year: 1984,
        tags: "Cyberpunk, AI, Cyberspace, Dystopian"
    },
    {
        title: "Superintelligence: Paths, Dangers, Strategies",
        author: "Nick Bostrom",
        category: "Artificial Intelligence",
        isbn: "978-0198739838",
        quantity: 3,
        available_quantity: 3,
        description: "What happens when machines surpass humans in general intelligence? Philosopher Nick Bostrom investigates the existential risks and strategies for steering machine superintelligence.",
        cover_url: "https://images.unsplash.com/photo-1507146153580-69a1fe6d8aa1?w=500&auto=format&fit=crop&q=80",
        rating: 4.5,
        published_year: 2014,
        tags: "AI Safety, Superintelligence, Philosophy, Future"
    },
    {
        title: "Thinking, Fast and Slow",
        author: "Daniel Kahneman",
        category: "Psychology",
        isbn: "978-0374533557",
        quantity: 5,
        available_quantity: 4,
        description: "Nobel laureate Daniel Kahneman takes us on a groundbreaking tour of the mind, explaining the two systems that drive the way we think: fast, intuitive thinking vs. slow, deliberate thought.",
        cover_url: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=500&auto=format&fit=crop&q=80",
        rating: 4.7,
        published_year: 2011,
        tags: "Psychology, Behavioral Economics, Decision Making, Cognitive Bias"
    },
    {
        title: "Sapiens: A Brief History of Humankind",
        author: "Yuval Noah Harari",
        category: "History & Philosophy",
        isbn: "978-0062316097",
        quantity: 7,
        available_quantity: 6,
        description: "How did an insignificant ape become the ruler of planet Earth? Harari spans the whole of human history from the Cognitive Revolution to the scientific era.",
        cover_url: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=500&auto=format&fit=crop&q=80",
        rating: 4.8,
        published_year: 2014,
        tags: "History, Anthropology, Evolution, Society"
    },
    {
        title: "Atomic Habits",
        author: "James Clear",
        category: "Personal Development",
        isbn: "978-0735211292",
        quantity: 8,
        available_quantity: 7,
        description: "An easy and proven way to build good habits and break bad ones. Reveals practical strategies that teach you how to form good habits, break bad ones, and master tiny behaviors.",
        cover_url: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=500&auto=format&fit=crop&q=80",
        rating: 4.9,
        published_year: 2018,
        tags: "Self-Improvement, Habits, Productivity, Psychology"
    },
    {
        title: "Astrophysics for People in a Hurry",
        author: "Neil deGrasse Tyson",
        category: "Science",
        isbn: "978-0393609394",
        quantity: 4,
        available_quantity: 4,
        description: "Essential cosmic truths delivered in bite-sized, witty, and mind-expanding chapters covering black holes, quantum mechanics, and the search for alien life.",
        cover_url: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=500&auto=format&fit=crop&q=80",
        rating: 4.7,
        published_year: 2017,
        tags: "Astrophysics, Space, Astronomy, Cosmos, Physics"
    },
    {
        title: "Introduction to Algorithms (CLRS)",
        author: "Cormen, Leiserson, Rivest & Stein",
        category: "Computer Science",
        isbn: "978-0262033848",
        quantity: 4,
        available_quantity: 3,
        description: "The globally acclaimed algorithm bible. In-depth mathematical rigor and pseudocode analysis of sorting, graph algorithms, dynamic programming, and complexity.",
        cover_url: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=500&auto=format&fit=crop&q=80",
        rating: 4.8,
        published_year: 2009,
        tags: "Algorithms, Data Structures, Complexity, Computer Science"
    },
    {
        title: "Life 3.0: Being Human in the Age of Artificial Intelligence",
        author: "Max Tegmark",
        category: "Artificial Intelligence",
        isbn: "978-1101946596",
        quantity: 4,
        available_quantity: 4,
        description: "MIT professor Max Tegmark explores how artificial intelligence will affect crime, war, justice, jobs, society, and our very sense of being human.",
        cover_url: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=500&auto=format&fit=crop&q=80",
        rating: 4.6,
        published_year: 2017,
        tags: "AI, Future, Society, Ethics, Consciousness"
    }
];

const sampleMembers = [
    {
        member_code: "MEM-1001",
        name: "Dev Patel",
        email: "dev.patel@library.edu",
        phone: "+1 (555) 234-5678",
        tier: "Student",
        status: "Active",
        max_books: 5
    },
    {
        member_code: "MEM-1002",
        name: "Dr. Sophia Chen",
        email: "sophia.chen@university.org",
        phone: "+1 (555) 345-6789",
        tier: "Faculty",
        status: "Active",
        max_books: 10
    },
    {
        member_code: "MEM-1003",
        name: "Marcus Vance",
        email: "marcus.v@innovate.tech",
        phone: "+1 (555) 456-7890",
        tier: "Scholar",
        status: "Active",
        max_books: 8
    },
    {
        member_code: "MEM-1004",
        name: "Emily Watson",
        email: "emily.w@designstudio.io",
        phone: "+1 (555) 567-8901",
        tier: "Student",
        status: "Active",
        max_books: 5
    },
    {
        member_code: "MEM-1005",
        name: "Alex Rivera",
        email: "alex.rivera@ai-labs.com",
        phone: "+1 (555) 678-9012",
        tier: "Premium",
        status: "Active",
        max_books: 12
    }
];

const sampleUsers = [
    {
        name: "Chief Librarian Elena Vance",
        email: "admin@athenalib.io",
        password: "admin123",
        role: "admin",
        member_id: null,
        phone: "+1 (555) 019-2831",
        avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    },
    {
        name: "Dev Patel",
        email: "dev.patel@library.edu",
        password: "password123",
        role: "member",
        member_id: 1,
        phone: "+1 (555) 234-5678",
        avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"
    },
    {
        name: "Dr. Sophia Chen",
        email: "sophia.chen@university.org",
        password: "password123",
        role: "member",
        member_id: 2,
        phone: "+1 (555) 345-6789",
        avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
    },
    {
        name: "Marcus Vance",
        email: "marcus.v@innovate.tech",
        password: "password123",
        role: "member",
        member_id: 3,
        phone: "+1 (555) 456-7890",
        avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
    },
    {
        name: "Emily Watson",
        email: "emily.w@designstudio.io",
        password: "password123",
        role: "member",
        member_id: 4,
        phone: "+1 (555) 567-8901",
        avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"
    }
];

async function seedDatabase() {
    console.log("[Seeder] Initializing database...");
    await db.initDB();

    // Check if users exist, if not, seed users
    const [existingUsers] = await db.query("SELECT * FROM users LIMIT 1");
    if (!existingUsers || existingUsers.length === 0) {
        console.log("[Seeder] Inserting sample user accounts with login credentials...");
        for (const u of sampleUsers) {
            await db.query(
                `INSERT INTO users (name, email, password_hash, role, member_id, phone, avatar_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    u.name,
                    u.email,
                    hashPassword(u.password),
                    u.role,
                    u.member_id,
                    u.phone,
                    u.avatar_url
                ]
            );
        }
    }

    // Check if books already exist
    const [existing] = await db.query("SELECT * FROM books LIMIT 1");
    if (existing && existing.length > 0) {
        console.log("[Seeder] Database already populated with book records. Skipping initial seeding.");
        return;
    }

    console.log("[Seeder] Inserting sample books...");
    for (const b of sampleBooks) {
        await db.query(
            `INSERT INTO books (title, author, category, isbn, quantity, available_quantity, description, cover_url, rating, published_year, tags)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                b.title,
                b.author,
                b.category,
                b.isbn,
                b.quantity,
                b.available_quantity,
                b.description,
                b.cover_url,
                b.rating,
                b.published_year,
                b.tags
            ]
        );
    }

    console.log("[Seeder] Inserting sample members...");
    for (const m of sampleMembers) {
        await db.query(
            `INSERT INTO members (member_code, name, email, phone, tier, status, max_books)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                m.member_code,
                m.name,
                m.email,
                m.phone,
                m.tier,
                m.status,
                m.max_books
            ]
        );
    }

    console.log("[Seeder] Inserting sample circulation records...");
    const today = new Date();
    const pastDate = (daysAgo) => {
        const d = new Date(today);
        d.setDate(d.getDate() - daysAgo);
        return d.toISOString().split("T")[0];
    };
    const futureDate = (daysAhead) => {
        const d = new Date(today);
        d.setDate(d.getDate() + daysAhead);
        return d.toISOString().split("T")[0];
    };

    // 1. Active Loan - On Time
    await db.query(
        `INSERT INTO transactions (book_id, member_id, issue_date, due_date, status, fine_amount, fine_paid, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [1, 1, pastDate(4), futureDate(10), "Issued", 0.00, 0, "Initial student checkout"]
    );

    // 2. Active Loan - Due Soon
    await db.query(
        `INSERT INTO transactions (book_id, member_id, issue_date, due_date, status, fine_amount, fine_paid, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [3, 2, pastDate(12), futureDate(2), "Issued", 0.00, 0, "Faculty research reference"]
    );

    // 3. Overdue Loan (5 days overdue -> $2.50 fine)
    await db.query(
        `INSERT INTO transactions (book_id, member_id, issue_date, due_date, status, fine_amount, fine_paid, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [6, 4, pastDate(19), pastDate(5), "Overdue", 2.50, 0, "System detected late return"]
    );

    // 4. Completed Returned Loan
    await db.query(
        `INSERT INTO transactions (book_id, member_id, issue_date, due_date, return_date, status, fine_amount, fine_paid, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [5, 3, pastDate(25), pastDate(11), pastDate(12), "Returned", 0.00, 1, "Returned in pristine condition"]
    );

    console.log("[Seeder] Seeding completed successfully!");
}

if (require.main === module) {
    seedDatabase().then(() => {
        console.log("[Seeder] Done.");
        process.exit(0);
    }).catch(err => {
        console.error("[Seeder Error]", err);
        process.exit(1);
    });
}

module.exports = { seedDatabase };
