const db = require('../../database/db');

const getTeacherData = (userId) => {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT t.*, u.name as name
            FROM teachers t
            JOIN users u ON t.user_id = u.id
            WHERE u.id = ?
        `, [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

exports.getDashboard = async (req, res) => {
    try {
        const teacher = await getTeacherData(req.session.user.id);
        res.render('teacher/dashboard', { teacher });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

exports.getClasses = async (req, res) => {
    try {
        const teacher = await getTeacherData(req.session.user.id);

        // Setup query to find classes this teacher teaches (via subjects) AND homeroom
        // For simplicity, we just list the homeroom class students first or all classes
        // Let's list the homeroom class details

        db.all(`
            SELECT s.*, u.name
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.class_id = ?
        `, [teacher.homeroom_class_id], (err, students) => {
            if (err) throw err;
            res.render('teacher/classes', { teacher, students });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

exports.updateBehavior = (req, res) => {
    const { student_id, score_change, reason } = req.body;
    // We need to fetch the teacher id first, ideally store in session or fetch
    // For now assuming we can get it or just pass 0 if lazy, but let's do it right
    getTeacherData(req.session.user.id).then(teacher => {
        db.run(`INSERT INTO behaviors (student_id, score_change, reason, teacher_id) VALUES (?, ?, ?, ?)`,
            [student_id, score_change, reason, teacher.id], (err) => {
                if (err) console.error(err);
                res.redirect('/teacher/classes');
            });
    });
};

exports.getRequests = (req, res) => {
    db.all('SELECT * FROM requests WHERE sender_id = ? ORDER BY created_at DESC', [req.session.user.id], (err, requests) => {
        if (err) throw err;
        res.render('teacher/requests', { requests });
    });
};

exports.postRequest = (req, res) => {
    const { type, details } = req.body;
    db.run('INSERT INTO requests (sender_id, type, details) VALUES (?, ?, ?)',
        [req.session.user.id, type, details], (err) => {
            if (err) console.error(err);
            res.redirect('/teacher/requests');
        });
};
