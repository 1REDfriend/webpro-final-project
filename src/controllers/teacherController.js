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

const processGrades = (grades) => {
    const groupedGrades = {};
    let totalCredits = 0;
    let totalPoints = 0;

    grades.forEach(g => {
        const levelCode = g.code ? g.code.substring(1, 3) : '';
        let level = 'ม.1';
        if (levelCode === '21') level = 'ม.1';
        else if (levelCode === '22') level = 'ม.2';
        else if (levelCode === '23') level = 'ม.3';
        else if (levelCode === '31') level = 'ม.4';
        else if (levelCode === '32') level = 'ม.5';
        else if (levelCode === '33') level = 'ม.6';
        g.grade_level = level;

        const lastDigit = g.code ? g.code.slice(-1) : '1';
        let semester = (parseInt(lastDigit) % 2 === 0) ? '2' : '1';
        g.semester = semester;

        let points = 0;
        if (g.grade_char === 'A') points = 4.0;
        else if (g.grade_char === 'B+') points = 3.5;
        else if (g.grade_char === 'B') points = 3.0;
        else if (g.grade_char === 'C+') points = 2.5;
        else if (g.grade_char === 'C') points = 2.0;
        else if (g.grade_char === 'D+') points = 1.5;
        else if (g.grade_char === 'D') points = 1.0;
        else points = 0;

        totalPoints += points * g.credit;
        totalCredits += g.credit;

        const groupKey = `${level}-${semester}`;
        if (!groupedGrades[groupKey]) {
            groupedGrades[groupKey] = {
                level: level,
                semester: semester,
                grades: [],
                totalCredits: 0,
                totalPoints: 0
            };
        }

        groupedGrades[groupKey].grades.push(g);
        groupedGrades[groupKey].totalCredits += g.credit;
        groupedGrades[groupKey].totalPoints += points * g.credit;
    });

    const groups = Object.values(groupedGrades).map(group => {
        group.gpa = group.totalCredits > 0 ? (group.totalPoints / group.totalCredits).toFixed(2) : '0.00';
        return group;
    });

    groups.sort((a, b) => {
        const levelA = parseInt(a.level.replace('ม.', '')) || 0;
        const levelB = parseInt(b.level.replace('ม.', '')) || 0;
        if (levelA !== levelB) return levelA - levelB;
        return parseInt(a.semester) - parseInt(b.semester);
    });

    const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';

    return { groups, gpa };
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

exports.getStudentGrades = async (req, res) => {
    try {
        const teacher = await getTeacherData(req.session.user.id);
        const studentId = req.params.id;

        // Fetch student details
        db.get(`
            SELECT s.*, c.name as classroom_name, u.full_name as name, u.profile_pic
            FROM students s
            JOIN users u ON s.user_id = u.id
            JOIN classrooms c ON s.classroom_id = c.id
            WHERE s.id = ?
        `, [studentId], (err, student) => {
            if (err) throw err;
            if (!student) return res.status(404).send('Student not found');

            // Fetch student grades
            db.all(`
                SELECT e.*, sub.code, sub.name, sub.credit
                FROM enrollments e
                JOIN subjects sub ON e.subject_id = sub.id
                WHERE e.student_id = ?
            `, [studentId], (err, grades) => {
                if (err) throw err;

                const processedData = processGrades(grades);
                res.render('teacher/student_grades', { teacher, student, groups: processedData.groups, gpa: processedData.gpa });
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};
