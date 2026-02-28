const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

// SQLite database setup
const dbPath = path.join(__dirname, 'watchlist.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
        db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
            if (pragmaErr) console.error('Error enabling foreign keys:', pragmaErr);
            initializeDatabase();
        });
    }
});

// Initialize database tables
function initializeDatabase() {
    // Main watchlist table storing entire dataset as JSON
    db.run(`
        CREATE TABLE IF NOT EXISTS watchlist_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_name TEXT,
            snapshot_data JSON NOT NULL,
            metadata JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT
        )
    `, (err) => {
        if (err) {
            console.error('Error creating watchlist_snapshots table:', err);
        } else {
            console.log('Watchlist snapshots table ready');
        }
    });

    // Symbol details table for individual tracking
    db.run(`
        CREATE TABLE IF NOT EXISTS symbols (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL UNIQUE,
            symbol_data JSON NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating symbols table:', err);
        } else {
            console.log('Symbols table ready');
        }
    });

    // History/audit log table
    db.run(`
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            symbol TEXT,
            change_data JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating history table:', err);
        } else {
            console.log('History table ready');
        }
    });

    // Blogs table
    db.run(`
        CREATE TABLE IF NOT EXISTS blogs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Error creating blogs table:', err);
        else console.log('Blogs table ready');
    });

    // Images table
    db.run(`
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            blog_id INTEGER,
            mime_type TEXT NOT NULL,
            data BLOB NOT NULL,
            FOREIGN KEY(blog_id) REFERENCES blogs(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) console.error('Error creating images table:', err);
        else console.log('Images table ready');
    });
}

// API endpoint to save watchlist data
app.post('/api/save-watchlist', (req, res) => {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: 'Invalid data format' });
    }

    // Create snapshot with all data
    const snapshot = {
        total_symbols: data.length,
        timestamp: new Date().toISOString(),
        data: data
    };

    const metadata = {
        record_count: data.length,
        index_etfs: data.filter(d => ['SPY', 'QQQ', 'VOO', 'TQQQ'].includes(d.Symbol)).length,
        sector_etfs: data.filter(d => ['XLF', 'XLE', 'XLI', 'XLU', 'XLV', 'XLP', 'XLY', 'XLC', 'XLK', 'XLRE'].includes(d.Symbol)).length,
        completed_symbols: data.filter(d => d.Daily && d.Weekly && d.Monthly).length,
        skipped_symbols: data.filter(d => d.Skip === 'true').length
    };

    // Save snapshot
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        let symbolsProcessed = 0;
        const errors = [];

        // Save each symbol individually
        data.forEach((row) => {
            const symbolData = {
                symbol: row.Symbol,
                daily: row.Daily || '',
                weekly: row.Weekly || '',
                monthly: row.Monthly || '',
                comment: row.Comment || '',
                skip: row.Skip === 'true',
                status: {
                    completed: !!(row.Daily && row.Weekly && row.Monthly),
                    skipped: row.Skip === 'true'
                }
            };

            db.run(
                `INSERT OR REPLACE INTO symbols (symbol, symbol_data, updated_at)
                 VALUES (?, ?, CURRENT_TIMESTAMP)`,
                [row.Symbol, JSON.stringify(symbolData)],
                (err) => {
                    symbolsProcessed++;
                    if (err) {
                        errors.push({ symbol: row.Symbol, error: err.message });
                    }

                    // After all symbols are processed, save the snapshot
                    if (symbolsProcessed === data.length) {
                        if (errors.length > 0) {
                            db.run('ROLLBACK');
                            return res.status(400).json({
                                error: 'Some rows failed to save',
                                details: errors
                            });
                        }

                        // Save the complete snapshot
                        db.run(
                            `INSERT INTO watchlist_snapshots (snapshot_name, snapshot_data, metadata, notes)
                             VALUES (?, ?, ?, ?)`,
                            [`snapshot_${Date.now()}`, JSON.stringify(snapshot), JSON.stringify(metadata), 'Auto-saved watchlist'],
                            (snapshotErr) => {
                                if (snapshotErr) {
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Failed to save snapshot' });
                                }

                                // Log the save action
                                db.run(
                                    `INSERT INTO history (action, change_data)
                                     VALUES (?, ?)`,
                                    ['SAVE_WATCHLIST', JSON.stringify({
                                        symbols_count: data.length,
                                        timestamp: new Date().toISOString()
                                    })],
                                    (historyErr) => {
                                        if (historyErr) {
                                            console.error('History log error:', historyErr);
                                        }

                                        db.run('COMMIT', (commitErr) => {
                                            if (commitErr) {
                                                return res.status(500).json({ error: 'Transaction commit failed' });
                                            }
                                            res.json({
                                                success: true,
                                                message: `Successfully saved ${data.length} records to database`,
                                                snapshot_id: `snapshot_${Date.now()}`,
                                                metadata: metadata,
                                                dbPath: dbPath
                                            });
                                        });
                                    }
                                );
                            }
                        );
                    }
                }
            );
        });
    });
});

// API endpoint to load watchlist data from database (latest snapshot)
app.get('/api/load-watchlist', (req, res) => {
    db.get(
        `SELECT snapshot_data, metadata, created_at FROM watchlist_snapshots ORDER BY id DESC LIMIT 1`,
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (!row) {
                return res.json({
                    success: true,
                    data: [],
                    count: 0,
                    message: 'No snapshots found in database'
                });
            }

            const snapshot = JSON.parse(row.snapshot_data);
            const metadata = JSON.parse(row.metadata);

            res.json({
                success: true,
                data: snapshot.data,
                count: snapshot.data.length,
                metadata: metadata,
                snapshot_created: row.created_at
            });
        }
    );
});

// API endpoint to get all snapshots (history)
app.get('/api/snapshots', (req, res) => {
    db.all(
        `SELECT id, snapshot_name, metadata, created_at FROM watchlist_snapshots ORDER BY id DESC LIMIT 20`,
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            const snapshots = rows.map(row => ({
                id: row.id,
                name: row.snapshot_name,
                metadata: JSON.parse(row.metadata),
                created_at: row.created_at
            }));

            res.json({
                success: true,
                snapshots: snapshots,
                count: snapshots.length
            });
        }
    );
});

// API endpoint to load specific snapshot by ID
app.get('/api/snapshot/:id', (req, res) => {
    const { id } = req.params;

    db.get(
        `SELECT snapshot_data, metadata, created_at FROM watchlist_snapshots WHERE id = ?`,
        [id],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (!row) {
                return res.status(404).json({ error: 'Snapshot not found' });
            }

            const snapshot = JSON.parse(row.snapshot_data);
            const metadata = JSON.parse(row.metadata);

            res.json({
                success: true,
                snapshot_id: id,
                data: snapshot.data,
                metadata: metadata,
                created_at: row.created_at
            });
        }
    );
});

// API endpoint to get database info
app.get('/api/db-info', (req, res) => {
    db.serialize(() => {
        db.get(
            `SELECT COUNT(*) as snapshot_count FROM watchlist_snapshots`,
            (err, snapshotRow) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                db.get(
                    `SELECT COUNT(*) as symbol_count FROM symbols`,
                    (symbolErr, symbolRow) => {
                        if (symbolErr) {
                            return res.status(500).json({ error: symbolErr.message });
                        }

                        db.get(
                            `SELECT COUNT(*) as history_count FROM history`,
                            (historyErr, historyRow) => {
                                if (historyErr) {
                                    return res.status(500).json({ error: historyErr.message });
                                }

                                res.json({
                                    success: true,
                                    dbPath: dbPath,
                                    tables: {
                                        snapshots: snapshotRow.snapshot_count,
                                        symbols: symbolRow.symbol_count,
                                        history: historyRow.history_count
                                    }
                                });
                            }
                        );
                    }
                );
            }
        );
    });
});

// API endpoint to clear database
app.post('/api/clear-database', (req, res) => {
    db.serialize(() => {
        db.run('DELETE FROM watchlist_snapshots');
        db.run('DELETE FROM symbols');
        db.run('DELETE FROM history', (err) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, message: 'All database tables cleared' });
        });
    });
});

// --- Blog System Endpoints ---

// Create a new blog
app.post('/api/blogs', (req, res) => {
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    db.run(
        'INSERT INTO blogs (title, content) VALUES (?, ?)',
        [title, ''], // We will update content after image extraction
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            const blogId = this.lastID;
            let processedContent = content;
            const imgRegex = /src="data:(image\/[^;]+);base64,([^"]+)"/g;
            let match;
            const imagesToInsert = [];

            // Extract all base64 images
            while ((match = imgRegex.exec(content)) !== null) {
                const mimeType = match[1];
                const base64Data = match[2];
                const buffer = Buffer.from(base64Data, 'base64');
                const fullMatchUrl = match[0].substring(5, match[0].length - 1); // Extract the actual data URL without src=" " 
                imagesToInsert.push({ mimeType, buffer, originalUrl: fullMatchUrl });
            }

            if (imagesToInsert.length === 0) {
                db.run('UPDATE blogs SET content = ? WHERE id = ?', [processedContent, blogId], (updErr) => {
                    if (updErr) return res.status(500).json({ error: updErr.message });
                    res.json({ success: true, blog_id: blogId });
                });
                return;
            }

            let insertedImages = 0;
            // Insert images and replace URLs
            imagesToInsert.forEach((img) => {
                db.run(
                    'INSERT INTO images (blog_id, mime_type, data) VALUES (?, ?, ?)',
                    [blogId, img.mimeType, img.buffer],
                    function (imgErr) {
                        if (imgErr) console.error('Error saving image:', imgErr);
                        const imageId = this.lastID;

                        // Replace the original base64 string with our API endpoint
                        processedContent = processedContent.replace(img.originalUrl, `/api/images/${imageId}`);
                        insertedImages++;

                        // When all images are inserted, update the blog content
                        if (insertedImages === imagesToInsert.length) {
                            db.run('UPDATE blogs SET content = ? WHERE id = ?', [processedContent, blogId], (updErr) => {
                                if (updErr) return res.status(500).json({ error: updErr.message });
                                res.json({ success: true, blog_id: blogId });
                            });
                        }
                    }
                );
            });
        }
    );
});

// Update an existing blog
app.put('/api/blogs/:id', (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    // First, clear existing images for this blog (cascade normally handles delete, but we are updating)
    db.run('DELETE FROM images WHERE blog_id = ?', [id], (delErr) => {
        if (delErr) return res.status(500).json({ error: delErr.message });

        db.run(
            'UPDATE blogs SET title = ?, content = ? WHERE id = ?',
            [title, '', id], // Temporarily set content to empty while processing images
            function (err) {
                if (err) return res.status(500).json({ error: err.message });

                let processedContent = content;
                const imgRegex = /src="data:(image\/[^;]+);base64,([^"]+)"/g;
                let match;
                const imagesToInsert = [];

                // Extract all base64 images
                while ((match = imgRegex.exec(content)) !== null) {
                    const mimeType = match[1];
                    const base64Data = match[2];
                    const buffer = Buffer.from(base64Data, 'base64');
                    const fullMatchUrl = match[0].substring(5, match[0].length - 1);
                    imagesToInsert.push({ mimeType, buffer, originalUrl: fullMatchUrl });
                }

                if (imagesToInsert.length === 0) {
                    db.run('UPDATE blogs SET content = ? WHERE id = ?', [processedContent, id], (updErr) => {
                        if (updErr) return res.status(500).json({ error: updErr.message });
                        res.json({ success: true, blog_id: id });
                    });
                    return;
                }

                let insertedImages = 0;
                imagesToInsert.forEach((img) => {
                    db.run(
                        'INSERT INTO images (blog_id, mime_type, data) VALUES (?, ?, ?)',
                        [id, img.mimeType, img.buffer],
                        function (imgErr) {
                            if (imgErr) console.error('Error saving image:', imgErr);
                            const imageId = this.lastID;

                            processedContent = processedContent.replace(img.originalUrl, `/api/images/${imageId}`);
                            insertedImages++;

                            if (insertedImages === imagesToInsert.length) {
                                db.run('UPDATE blogs SET content = ? WHERE id = ?', [processedContent, id], (updErr) => {
                                    if (updErr) return res.status(500).json({ error: updErr.message });
                                    res.json({ success: true, blog_id: id });
                                });
                            }
                        }
                    );
                });
            }
        );
    });
});

// Get all blogs list
app.get('/api/blogs', (req, res) => {
    db.all(
        'SELECT id, title, created_at FROM blogs ORDER BY created_at DESC',
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, blogs: rows });
        }
    );
});

// Get a specific blog
app.get('/api/blogs/:id', (req, res) => {
    db.get(
        'SELECT id, title, content, created_at FROM blogs WHERE id = ?',
        [req.params.id],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Blog not found' });
            res.json({ success: true, blog: row });
        }
    );
});

// Serve an image blob
app.get('/api/images/:id', (req, res) => {
    db.get(
        'SELECT mime_type, data FROM images WHERE id = ?',
        [req.params.id],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Image not found' });

            res.setHeader('Content-Type', row.mime_type);
            res.send(row.data);
        }
    );
});

// Delete a blog
app.delete('/api/blogs/:id', (req, res) => {
    // Foreign key constraint ON DELETE CASCADE will delete associated images automatically
    db.run('DELETE FROM blogs WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Blog not found' });
        res.json({ success: true, message: 'Blog deleted' });
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Database location: ${dbPath}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});
