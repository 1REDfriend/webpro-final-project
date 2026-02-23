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

exports.getEditTeacher = (req, res) => {
    const teacherId = req.params.id;
    db.get('SELECT id, username, full_name, profile_pic FROM users WHERE id = ? AND role = "teacher"', [teacherId], (err, teacher) => {
        if (err || !teacher) {
            console.error(err);
            return res.status(404).send('Teacher not found or database error');
        }
        res.render('executive/edit_teacher', { teacher, error: req.query.error || null, success: req.query.success || null });
    });
};

exports.updateTeacher = (req, res) => {
    const teacherId = req.params.id;
    const { username, password, full_name } = req.body;

    // Check if new username belongs to another user
    db.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, teacherId], (err, row) => {
        if (err) {
            console.error(err);
            return res.redirect(`/executive/teachers/${teacherId}/edit?error=Database Error`);
        }
        if (row) {
            return res.redirect(`/executive/teachers/${teacherId}/edit?error=มีชื่อผู้ใช้นี้ในระบบแล้ว`);
        }

        if (password && password.trim() !== '') {
            // Update with new password
            db.run('UPDATE users SET username = ?, password = ?, full_name = ? WHERE id = ? AND role = "teacher"',
                [username, password, full_name, teacherId], (err) => {
                    if (err) {
                        console.error(err);
                        return res.redirect(`/executive/teachers/${teacherId}/edit?error=Database Error`);
                    }
                    res.redirect('/executive/teachers?success=อัปเดตข้อมูลครูเรียบร้อยแล้ว');
                });
        } else {
            // Update without changing password
            db.run('UPDATE users SET username = ?, full_name = ? WHERE id = ? AND role = "teacher"',
                [username, full_name, teacherId], (err) => {
                    if (err) {
                        console.error(err);
                        return res.redirect(`/executive/teachers/${teacherId}/edit?error=Database Error`);
                    }
                    res.redirect('/executive/teachers?success=อัปเดตข้อมูลครูเรียบร้อยแล้ว');
                });
        }
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

// --- Manage Student Details ---

exports.getManageStudent = (req, res) => {
    const studentId = req.params.student_id;

    const queryStudent = `
        SELECT s.id as student_id, u.id as user_id, u.username as student_code, u.full_name, c.name as classroom_name, s.classroom_id
        FROM students s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN classrooms c ON s.classroom_id = c.id
        WHERE s.id = ?
    `;

    db.get(queryStudent, [studentId], (err, student) => {
        if (err || !student) {
            console.error(err);
            return res.status(500).send('Database Error');
        }

        const queryEnrolled = `
            SELECT sub.id, sub.code, sub.name, sub.credit 
            FROM enrollments e 
            JOIN subjects sub ON e.subject_id = sub.id 
            WHERE e.student_id = ?
            ORDER BY sub.code
        `;

        db.all(queryEnrolled, [studentId], (err, enrolledSubjects) => {
            if (err) return res.status(500).send('Database Error');

            const queryAvailable = `
                SELECT id, code, name, credit 
                FROM subjects 
                WHERE id NOT IN (SELECT subject_id FROM enrollments WHERE student_id = ?)
                ORDER BY code
            `;

            db.all(queryAvailable, [studentId], (err, availableSubjects) => {
                if (err) return res.status(500).send('Database Error');

                db.all('SELECT id, name FROM classrooms ORDER BY name', (err, classrooms) => {
                    if (err) return res.status(500).send('Database Error');

                    res.render('executive/manage_student', {
                        student,
                        enrolledSubjects,
                        availableSubjects,
                        classrooms,
                        error: req.query.error || null,
                        success: req.query.success || null
                    });
                });
            });
        });
    });
};

exports.updateStudentClassroom = (req, res) => {
    const studentId = req.params.student_id;
    const { classroom_id } = req.body;

    db.run('UPDATE students SET classroom_id = ? WHERE id = ?', [classroom_id, studentId], (err) => {
        if (err) {
            console.error(err);
            return res.redirect(`/executive/students/${studentId}/manage?error=ไม่สามารถอัปเดตห้องเรียนได้`);
        }
        res.redirect(`/executive/students/${studentId}/manage?success=อัปเดตห้องเรียนเรียบร้อยแล้ว`);
    });
};

exports.addSubjectToStudent = (req, res) => {
    const studentId = req.params.student_id;
    const { subject_id } = req.body;

    if (!subject_id) {
        return res.redirect(`/executive/students/${studentId}/manage?error=กรุณาเลือกรายวิชา`);
    }

    db.run('INSERT INTO enrollments (student_id, subject_id, grade_midterm, grade_final, total_score, grade_char) VALUES (?, ?, 0, 0, 0, NULL)',
        [studentId, subject_id], (err) => {
            if (err) {
                console.error(err);
                return res.redirect(`/executive/students/${studentId}/manage?error=ไม่สามารถเพิ่มรายวิชาได้`);
            }
            res.redirect(`/executive/students/${studentId}/manage?success=เพิ่มรายวิชาเรียบร้อยแล้ว`);
        });
};

exports.removeSubjectFromStudent = (req, res) => {
    const studentId = req.params.student_id;
    const { subject_id } = req.body;

    db.run('DELETE FROM enrollments WHERE student_id = ? AND subject_id = ?', [studentId, subject_id], (err) => {
        if (err) {
            console.error(err);
            return res.redirect(`/executive/students/${studentId}/manage?error=ไม่สามารถลบรายวิชาได้`);
        }
        res.redirect(`/executive/students/${studentId}/manage?success=ลบรายวิชาเรียบร้อยแล้ว`);
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
