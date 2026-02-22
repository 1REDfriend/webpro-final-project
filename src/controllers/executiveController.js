const db = require('../../database');

exports.getDashboard = async (req, res) => {
    try {
        const stats = {};

        // Count Students
        stats.studentCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as c FROM students', (e, r) => e ? reject(e) : resolve(r.c));
        });

        // Count Teachers
        stats.teacherCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as c FROM users WHERE role = "teacher"', (e, r) => e ? reject(e) : resolve(r.c));
        });

        // Count Staff
        stats.staffCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as c FROM users WHERE role = "staff"', (e, r) => e ? reject(e) : resolve(r.c));
        });

        // Count Requests Pending
        stats.requestPendingCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as c FROM requests WHERE status = "Pending"', (e, r) => e ? reject(e) : resolve(r.c));
        });

        // Count Requests Approved
        stats.requestApprovedCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as c FROM requests WHERE status = "Approved"', (e, r) => e ? reject(e) : resolve(r.c));
        });

        // Count Requests Rejected
        stats.requestRejectedCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as c FROM requests WHERE status = "Rejected"', (e, r) => e ? reject(e) : resolve(r.c));
        });

        // Average GPA Calculation (School Wide)
        stats.avgGpa = await new Promise((resolve, reject) => {
            db.all('SELECT total_score, credit FROM enrollments e JOIN subjects s ON e.subject_id = s.id', (err, rows) => {
                if (err) return reject(err);
                if (rows.length === 0) return resolve("0.00");
                let totalPoints = 0;
                let totalCredits = 0;
                rows.forEach(r => {
                    let points = 0;
                    if (r.total_score >= 80) points = 4;
                    else if (r.total_score >= 70) points = 3;
                    else if (r.total_score >= 60) points = 2;
                    else if (r.total_score >= 50) points = 1;

                    totalPoints += points * r.credit;
                    totalCredits += r.credit;
                });
                resolve(totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : "0.00");
            });
        });

        // Average GPA per classroom
        stats.gpaByClassroom = await new Promise((resolve, reject) => {
            const query = `
                SELECT c.name as classroom_name, e.total_score, sub.credit
                FROM enrollments e
                JOIN students s ON e.student_id = s.id
                JOIN classrooms c ON s.classroom_id = c.id
                JOIN subjects sub ON e.subject_id = sub.id
            `;
            db.all(query, (err, rows) => {
                if (err) return reject(err);

                const classData = {};
                rows.forEach(r => {
                    if (!classData[r.classroom_name]) {
                        classData[r.classroom_name] = { totalPoints: 0, totalCredits: 0 };
                    }

                    let points = 0;
                    if (r.total_score >= 80) points = 4;
                    else if (r.total_score >= 70) points = 3;
                    else if (r.total_score >= 60) points = 2;
                    else if (r.total_score >= 50) points = 1;

                    classData[r.classroom_name].totalPoints += points * r.credit;
                    classData[r.classroom_name].totalCredits += r.credit;
                });

                const result = [];
                for (const className in classData) {
                    const data = classData[className];
                    result.push({
                        classroom: className,
                        gpa: data.totalCredits > 0 ? (data.totalPoints / data.totalCredits).toFixed(2) : "0.00"
                    });
                }

                // Sort array by classroom name
                result.sort((a, b) => a.classroom.localeCompare(b.classroom));
                resolve(result);
            });
        });

        res.render('executive/dashboard', { stats });
    } catch (err) {
        console.error(err);
        res.status(500).send('Database Error');
    }
};

// --- Teacher Management ---

exports.getTeachers = (req, res) => {
    db.all('SELECT id, username, full_name, profile_pic FROM users WHERE role = "teacher" ORDER BY full_name', (err, teachers) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database Error');
        }
        res.render('executive/teachers', { teachers, error: null, success: null });
    });
};

exports.addTeacher = (req, res) => {
    const { username, password, full_name } = req.body;

    // Check if user exists
    db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database Error');
        }
        if (row) {
            // User exists
            return db.all('SELECT id, username, full_name, profile_pic FROM users WHERE role = "teacher" ORDER BY full_name', (err, teachers) => {
                res.render('executive/teachers', { teachers, error: 'มีชื่อผู้ใช้นี้ในระบบแล้ว', success: null });
            });
        }

        // Insert new teacher
        db.run('INSERT INTO users (username, password, role, full_name) VALUES (?, ?, "teacher", ?)', [username, password, full_name], function (err) {
            if (err) {
                console.error(err);
                return res.status(500).send('Database Error');
            }
            db.all('SELECT id, username, full_name, profile_pic FROM users WHERE role = "teacher" ORDER BY full_name', (err, teachers) => {
                res.render('executive/teachers', { teachers, error: null, success: 'เพิ่มข้อมูลครูเรียบร้อยแล้ว' });
            });
        });
    });
};

exports.deleteTeacher = (req, res) => {
    const teacherId = req.body.teacher_id;

    // 1. Unassign subjects from this teacher
    db.run('UPDATE subjects SET teacher_id = NULL WHERE teacher_id = ?', [teacherId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database Error');
        }

        // 2. Delete teacher from users table
        db.run('DELETE FROM users WHERE id = ? AND role = "teacher"', [teacherId], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Database Error');
            }
            res.redirect('/executive/teachers');
        });
    });
};

// --- Student Management ---

exports.getStudents = (req, res) => {
    const query = `
        SELECT s.id as student_id, u.id as user_id, u.username as student_code, u.full_name, c.name as classroom_name, u.profile_pic
        FROM students s
        JOIN users u ON s.user_id = u.id
        JOIN classrooms c ON s.classroom_id = c.id
        ORDER BY c.name, u.full_name
    `;

    db.all(query, (err, students) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database Error');
        }

        db.all('SELECT id, name FROM classrooms ORDER BY name', (err, classrooms) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Database Error');
            }
            res.render('executive/students', { students, classrooms, error: null, success: null });
        });
    });
};

exports.addStudent = (req, res) => {
    const { student_code, password, full_name, classroom_id } = req.body;

    // Check if user exists
    db.get('SELECT id FROM users WHERE username = ?', [student_code], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database Error');
        }
        if (row) {
            // User exists, re-render with error
            return exports.getStudentsWithError(req, res, 'มีรหัสนักเรียน/ชื่อผู้ใช้นี้ในระบบแล้ว', null);
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            db.run('INSERT INTO users (username, password, role, full_name) VALUES (?, ?, "student", ?)',
                [student_code, password, full_name],
                function (err) {
                    if (err) {
                        console.error("Insert user error:", err);
                        db.run('ROLLBACK');
                        return exports.getStudentsWithError(req, res, 'เกิดข้อผิดพลาดในการสร้างบัญชีนักเรียน', null);
                    }
                    const userId = this.lastID;

                    db.run('INSERT INTO students (user_id, classroom_id, student_code) VALUES (?, ?, ?)',
                        [userId, classroom_id, student_code],
                        function (err) {
                            if (err) {
                                console.error("Insert student error:", err);
                                db.run('ROLLBACK');
                                return exports.getStudentsWithError(req, res, 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลนักเรียน', null);
                            }
                            db.run('COMMIT');
                            exports.getStudentsWithError(req, res, null, 'เพิ่มข้อมูลนักเรียนเรียบร้อยแล้ว');
                        }
                    );
                }
            );
        });
    });
};

exports.deleteStudent = (req, res) => {
    const studentId = req.body.student_id;
    const userId = req.body.user_id;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 1. Delete from enrollments
        db.run('DELETE FROM enrollments WHERE student_id = ?', [studentId], (err) => {
            if (err) { console.error("Del enrollments err:", err); db.run('ROLLBACK'); return res.status(500).send('DB Error'); }

            // 2. Delete from students table
            db.run('DELETE FROM students WHERE id = ?', [studentId], (err) => {
                if (err) { console.error("Del students err:", err); db.run('ROLLBACK'); return res.status(500).send('DB Error'); }

                // 3. Delete from users table
                db.run('DELETE FROM users WHERE id = ? AND role = "student"', [userId], (err) => {
                    if (err) { console.error("Del users err:", err); db.run('ROLLBACK'); return res.status(500).send('DB Error'); }

                    db.run('COMMIT');
                    res.redirect('/executive/students');
                });
            });
        });
    });
};

// Helper for re-rendering students view with messages
exports.getStudentsWithError = (req, res, error, success) => {
    const query = `
        SELECT s.id as student_id, u.id as user_id, u.username as student_code, u.full_name, c.name as classroom_name, u.profile_pic
        FROM students s
        JOIN users u ON s.user_id = u.id
        JOIN classrooms c ON s.classroom_id = c.id
        ORDER BY c.name, u.full_name
    `;

    db.all(query, (err, students) => {
        if (err) return res.status(500).send('Database Error');
        db.all('SELECT id, name FROM classrooms ORDER BY name', (err, classrooms) => {
            if (err) return res.status(500).send('Database Error');
            res.render('executive/students', { students, classrooms, error, success });
        });
    });
};
