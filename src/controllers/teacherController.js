const db = require('../../database');

const getTeacherData = (userId) => {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT * FROM users WHERE id = ?
        `, [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

exports.getDashboard = async (req, res) => {
    try {
        const teacher = await getTeacherData(req.session.user.id);
        db.all(`SELECT * FROM subjects WHERE teacher_id = ?`, [teacher.id], (err, subjects) => {
            if (err) throw err;
            db.all(`SELECT * FROM classrooms ORDER BY name`, [], (err, classrooms) => {
                if (err) throw err;
                let homeroom = null;
                if (teacher.homeroom_classroom_id) {
                    const room = classrooms.find(c => c.id === teacher.homeroom_classroom_id);
                    homeroom = room ? room.name : null;
                }
                res.render('teacher/dashboard', { teacher, subjects, classrooms, homeroom });
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

exports.addSubject = (req, res) => {
    const { code, name, credit } = req.body;
    db.run(`INSERT INTO subjects (code, name, credit, teacher_id) VALUES (?, ?, ?, ?)`,
        [code, name, credit, req.session.user.id], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Database Error');
            }
            res.redirect('/teacher/dashboard');
        });
};

exports.selectHomeroom = (req, res) => {
    const { classroom_id } = req.body;
    db.run(`UPDATE users SET homeroom_classroom_id = ? WHERE id = ?`,
        [classroom_id, req.session.user.id], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Database Error');
            }
            res.redirect('/teacher/dashboard');
        });
};

exports.getClasses = async (req, res) => {
    try {
        const teacher = await getTeacherData(req.session.user.id);

        // Fetch subjects taught by this teacher
        db.all(`SELECT * FROM subjects WHERE teacher_id = ?`, [teacher.id], (err, subjects) => {
            if (err) throw err;

            // Fetch list of all classrooms for the filter dropdown
            db.all(`SELECT * FROM classrooms ORDER BY name`, [], (err, classrooms) => {
                if (err) throw err;

                const classroom_id = req.query.classroom_id;
                const subject_id = req.query.subject_id;

                let query = `
                    SELECT s.*, u.full_name as name, c.name as classroom_name
                    FROM students s
                    JOIN users u ON s.user_id = u.id
                    JOIN classrooms c ON s.classroom_id = c.id
                    WHERE 1=1
                `;
                let params = [];

                if (classroom_id) {
                    query += ` AND s.classroom_id = ?`;
                    params.push(classroom_id);
                }

                if (subject_id) {
                    query += ` AND s.id IN (SELECT student_id FROM enrollments WHERE subject_id = ?)`;
                    params.push(subject_id);
                }

                query += ` ORDER BY c.name, s.student_code`;

                db.all(query, params, (err, students) => {
                    if (err) throw err;
                    res.render('teacher/classes', { teacher, subjects, classrooms, students, filters: { classroom_id, subject_id } });
                });
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

exports.updateBehavior = (req, res) => {
    const { student_id, score_change } = req.body;
    db.run(`UPDATE students SET behavior_score = behavior_score + ? WHERE id = ?`,
        [score_change, student_id], (err) => {
            if (err) console.error(err);
            res.redirect('/teacher/classes');
        });
};

exports.updateGrade = (req, res) => {
    const { student_id, subject_id, grade_midterm, grade_final } = req.body;
    const total = parseFloat(grade_midterm) + parseFloat(grade_final);
    let grade_char = 'F';
    if (total >= 80) grade_char = 'A';
    else if (total >= 70) grade_char = 'B';
    else if (total >= 60) grade_char = 'C';
    else if (total >= 50) grade_char = 'D';

    // Check if enrollment exists
    db.get('SELECT * FROM enrollments WHERE student_id = ? AND subject_id = ?', [student_id, subject_id], (err, row) => {
        if (row) {
            db.run(`UPDATE enrollments SET grade_midterm = ?, grade_final = ?, total_score = ?, grade_char = ? WHERE student_id = ? AND subject_id = ?`,
                [grade_midterm, grade_final, total, grade_char, student_id, subject_id], (err) => {
                    if (err) console.error(err);
                    res.redirect('/teacher/classes');
                });
        } else {
            db.run(`INSERT INTO enrollments (student_id, subject_id, grade_midterm, grade_final, total_score, grade_char) VALUES (?, ?, ?, ?, ?, ?)`,
                [student_id, subject_id, grade_midterm, grade_final, total, grade_char], (err) => {
                    if (err) console.error(err);
                    res.redirect('/teacher/classes');
                });
        }
    });
};

exports.getRequests = (req, res) => {
    db.all('SELECT * FROM requests WHERE user_id = ? ORDER BY date DESC', [req.session.user.id], (err, requests) => {
        if (err) throw err;
        res.render('teacher/requests', { requests });
    });
};

exports.postRequest = (req, res) => {
    const { topic, description } = req.body;
    db.run('INSERT INTO requests (user_id, topic, description) VALUES (?, ?, ?)',
        [req.session.user.id, topic, description], (err) => {
            if (err) console.error(err);
            res.redirect('/teacher/requests');
        });
};
