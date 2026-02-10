const express = require('express');
const router = express.Router();
const db = require('../../database/db');

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err) {
            console.error(err);
            return res.render('auth/login', { error: 'System Error', user: null });
        }
        if (!row) {
            return res.render('auth/login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', user: null });
        }

        req.session.user = row;
        res.redirect(`/${row.role}/dashboard`);
    });
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;
