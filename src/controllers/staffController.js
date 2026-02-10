const db = require('../../database/db');

exports.getDashboard = (req, res) => {
    db.all(`
        SELECT r.*, u.name as sender_name, u.role as sender_role 
        FROM requests r
        JOIN users u ON r.sender_id = u.id
        ORDER BY r.created_at DESC
    `, (err, requests) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database Error');
        }
        res.render('staff/dashboard', { requests });
    });
};

exports.updateRequestStatus = (req, res) => {
    const { id, status, response } = req.body;
    db.run('UPDATE requests SET status = ?, response = ? WHERE id = ?',
        [status, response, id], (err) => {
            if (err) console.error(err);
            res.redirect('/staff/dashboard');
        });
};
