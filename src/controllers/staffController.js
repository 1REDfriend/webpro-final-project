const db = require('../../database');

exports.getDashboard = (req, res) => {
    db.all(`
        SELECT r.*, u.full_name as sender_name, u.role as sender_role 
        FROM requests r
        JOIN users u ON r.user_id = u.id
        ORDER BY r.date DESC
    `, (err, requests) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database Error');
        }
        res.render('staff/dashboard', { requests });
    });
};

exports.updateRequestStatus = (req, res) => {
    const { id, status, reply } = req.body;
    db.run('UPDATE requests SET status = ?, reply = ? WHERE id = ?',
        [status, reply, id], (err) => {
            if (err) console.error(err);
            res.redirect('/staff/dashboard');
        });
};
