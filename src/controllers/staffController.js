const db = require('../../database');

// ─── Staff Dashboard (with requests + announcements) ───────────────────────
exports.getDashboard = (req, res) => {
    db.all(`
        SELECT r.*, u.full_name as sender_name, u.role as sender_role
        FROM requests r
        JOIN users u ON r.user_id = u.id
        ORDER BY r.date DESC
    `, (err, requests) => {
        if (err) { console.error(err); return res.status(500).send('Database Error'); }

        db.all(`
            SELECT a.*, u.full_name as creator_name
            FROM announcements a
            JOIN users u ON a.created_by = u.id
            ORDER BY a.created_at DESC
        `, (err2, announcements) => {
            if (err2) { console.error(err2); announcements = []; }
            res.render('staff/dashboard', { requests, announcements, user: req.session.user });
        });
    });
};

// ─── Update Request Status ──────────────────────────────────────────────────
exports.updateRequestStatus = (req, res) => {
    const { id, status, reply } = req.body;
    db.run('UPDATE requests SET status = ?, reply = ? WHERE id = ?',
        [status, reply, id], (err) => {
            if (err) console.error(err);
            res.redirect('/staff/dashboard');
        });
};

// ─── Announcements ──────────────────────────────────────────────────────────
exports.createAnnouncement = (req, res) => {
    const { title, description, image_url, target_audience } = req.body;
    // Insert into both columns for backward-compat with existing DB (description_markdown is NOT NULL)
    db.run(
        `INSERT INTO announcements (title, description_markdown, description, image_url, target_audience, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [title, description, description, image_url || null, target_audience || 'both', req.session.user.id],
        (err) => {
            if (err) console.error(err);
            res.redirect('/staff/dashboard');
        }
    );
};

exports.deleteAnnouncement = (req, res) => {
    const { id } = req.body;
    db.run(`DELETE FROM announcements WHERE id = ?`, [id], (err) => {
        if (err) console.error(err);
        res.redirect('/staff/dashboard');
    });
};

exports.editAnnouncement = (req, res) => {
    const { id, title, description, image_url, target_audience } = req.body;
    db.run(
        `UPDATE announcements SET title = ?, description = ?, description_markdown = ?, image_url = ?, target_audience = ? WHERE id = ?`,
        [title, description, description, image_url || null, target_audience || 'both', id],
        (err) => {
            if (err) console.error(err);
            res.redirect('/staff/dashboard');
        }
    );
};
