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

    // Infer gender from Thai name prefix
    const isFemale = full_name.startsWith('นาง') || full_name.startsWith('น.ส.') || full_name.startsWith('Miss');
    const gender = isFemale ? 'female' : 'male';
    const profilePic = isFemale ? 'default-profile-women.png' : 'default-profile-men.png';

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
        db.run('INSERT INTO users (username, password, role, full_name, profile_pic, gender) VALUES (?, ?, "teacher", ?, ?, ?)', [username, password, full_name, profilePic, gender], function (err) {
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
    db.run('UPDATE subjects SET teacher_id = NULL WHERE teacher_id = ?', [teacherId], (err) => {
        if (err) { console.error(err); return res.status(500).send('Database Error'); }
        db.run('DELETE FROM users WHERE id = ? AND role = "teacher"', [teacherId], (err) => {
            if (err) { console.error(err); return res.status(500).send('Database Error'); }
            res.redirect('/executive/teachers');
        });
    });
};

exports.assignSubjectToTeacher = (req, res) => {
    const teacherId = req.params.id;
    const { subject_id } = req.body;
    db.run('UPDATE subjects SET teacher_id = ? WHERE id = ?', [teacherId, subject_id], (err) => {
        if (err) console.error(err);
        res.redirect(`/executive/teachers/${teacherId}/edit?success=มอบหมายวิชาเรียบร้อยแล้ว`);
    });
};

exports.unassignSubjectFromTeacher = (req, res) => {
    const teacherId = req.params.id;
    const { subject_id } = req.body;
    db.run('UPDATE subjects SET teacher_id = NULL WHERE id = ? AND teacher_id = ?', [subject_id, teacherId], (err) => {
        if (err) console.error(err);
        res.redirect(`/executive/teachers/${teacherId}/edit?success=ถอนวิชาเรียบร้อยแล้ว`);
    });
};

exports.assignHomeroomToTeacher = (req, res) => {
    const teacherId = req.params.id;
    const { classroom_id } = req.body;
    // Remove any existing homeroom teacher for that classroom first, then assign
    db.run('DELETE FROM homeroom_teachers WHERE classroom_id = ?', [classroom_id], (err) => {
        if (err) console.error(err);
        db.run('INSERT OR REPLACE INTO homeroom_teachers (teacher_id, classroom_id) VALUES (?, ?)', [teacherId, classroom_id], (err) => {
            if (err) console.error(err);
            res.redirect(`/executive/teachers/${teacherId}/edit?success=มอบหมายห้องดูแลเรียบร้อยแล้ว`);
        });
    });
};

exports.unassignHomeroomFromTeacher = (req, res) => {
    const teacherId = req.params.id;
    const { classroom_id } = req.body;
    db.run('DELETE FROM homeroom_teachers WHERE teacher_id = ? AND classroom_id = ?', [teacherId, classroom_id], (err) => {
        if (err) console.error(err);
        res.redirect(`/executive/teachers/${teacherId}/edit?success=ถอนห้องดูแลเรียบร้อยแล้ว`);
    });
};

exports.getEditTeacher = (req, res) => {
    const teacherId = req.params.id;
    db.get('SELECT id, username, full_name, profile_pic, gender FROM users WHERE id = ? AND role = "teacher"', [teacherId], (err, teacher) => {
        if (err || !teacher) return res.status(404).send('Teacher not found');
        db.all('SELECT id, code, name FROM subjects WHERE teacher_id = ? ORDER BY code', [teacherId], (err, assignedSubjects) => {
            if (err) assignedSubjects = [];
            db.all('SELECT id, code, name FROM subjects WHERE (teacher_id IS NULL OR teacher_id != ?) ORDER BY code', [teacherId], (err, unassignedSubjects) => {
                if (err) unassignedSubjects = [];
                db.all('SELECT DISTINCT c.id, c.name FROM classrooms c JOIN homeroom_teachers ht ON c.id = ht.classroom_id WHERE ht.teacher_id = ? ORDER BY c.name', [teacherId], (err, homeroomClasses) => {
                    if (err) homeroomClasses = [];
                    db.all('SELECT id, name FROM classrooms ORDER BY name', (err, allClassrooms) => {
                        if (err) allClassrooms = [];
                        res.render('executive/edit_teacher', { teacher, assignedSubjects, unassignedSubjects, homeroomClasses, allClassrooms, error: req.query.error || null, success: req.query.success || null });
                    });
                });
            });
        });
    });
};

exports.updateTeacher = (req, res) => {
    const teacherId = req.params.id;
    const { username, password, full_name, gender } = req.body;

    // Handle uploaded profile pic or keep existing
    const profilePic = req.file ? '/uploads/' + req.file.filename
        : (req.body.clear_pic === '1' ? (gender === 'female' ? 'default-profile-women.png' : 'default-profile-men.png')
            : req.body.existing_pic);

    db.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, teacherId], (err, row) => {
        if (err) return res.redirect(`/executive/teachers/${teacherId}/edit?error=Database Error`);
        if (row) return res.redirect(`/executive/teachers/${teacherId}/edit?error=มีชื่อผู้ใช้นี้ในระบบแล้ว`);

        const updateUser = (cb) => {
            if (password && password.trim() !== '') {
                db.run('UPDATE users SET username=?, password=?, full_name=?, gender=?, profile_pic=? WHERE id=? AND role="teacher"',
                    [username, password, full_name, gender, profilePic, teacherId], cb);
            } else {
                db.run('UPDATE users SET username=?, full_name=?, gender=?, profile_pic=? WHERE id=? AND role="teacher"',
                    [username, full_name, gender, profilePic, teacherId], cb);
            }
        };

        updateUser((err) => {
            if (err) { console.error(err); return res.redirect(`/executive/teachers/${teacherId}/edit?error=Database Error`); }
            res.redirect(`/executive/teachers/${teacherId}/edit?success=อัปเดตข้อมูลครูเรียบร้อยแล้ว`);
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

            // Infer gender from Thai name prefix
            const isFemale = full_name.startsWith('นาง') || full_name.startsWith('น.ส.') || full_name.startsWith('Miss') || full_name.startsWith('เด็กหญิง') || full_name.startsWith('ด.ญ.');
            const gender = isFemale ? 'female' : 'male';
            const profilePic = isFemale ? 'default-profile-women.png' : 'default-profile-men.png';

            db.run('INSERT INTO users (username, password, role, full_name, profile_pic, gender) VALUES (?, ?, "student", ?, ?, ?)',
                [student_code, password, full_name, profilePic, gender],
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
        db.run('DELETE FROM enrollments WHERE student_id = ?', [studentId], (err) => {
            if (err) { console.error(err); db.run('ROLLBACK'); return res.status(500).send('DB Error'); }
            db.run('DELETE FROM students WHERE id = ?', [studentId], (err) => {
                if (err) { console.error(err); db.run('ROLLBACK'); return res.status(500).send('DB Error'); }
                db.run('DELETE FROM users WHERE id = ? AND role = "student"', [userId], (err) => {
                    if (err) { console.error(err); db.run('ROLLBACK'); return res.status(500).send('DB Error'); }
                    db.run('COMMIT');
                    res.redirect('/executive/students');
                });
            });
        });
    });
};

exports.getEditStudent = (req, res) => {
    const studentId = req.params.student_id;
    db.get(`
        SELECT s.id as student_id, u.id as user_id, u.username as student_code,
               u.full_name, u.profile_pic, u.gender, s.classroom_id, c.name as classroom_name
        FROM students s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN classrooms c ON s.classroom_id = c.id
        WHERE s.id = ?
    `, [studentId], (err, student) => {
        if (err || !student) return res.status(404).send('Student not found');
        db.all('SELECT id, name FROM classrooms ORDER BY name', (err, classrooms) => {
            if (err) classrooms = [];
            db.all('SELECT sub.id, sub.code, sub.name, sub.credit FROM enrollments e JOIN subjects sub ON e.subject_id = sub.id WHERE e.student_id = ? ORDER BY sub.code', [studentId], (err, enrolledSubjects) => {
                if (err) enrolledSubjects = [];
                res.render('executive/edit_student', { student, classrooms, enrolledSubjects, error: req.query.error || null, success: req.query.success || null });
            });
        });
    });
};

exports.updateStudent = (req, res) => {
    const studentId = req.params.student_id;
    const { full_name, student_code, password, classroom_id, gender } = req.body;

    const profilePic = req.file ? '/uploads/' + req.file.filename
        : (req.body.clear_pic === '1' ? (gender === 'female' ? 'default-profile-women.png' : 'default-profile-men.png')
            : req.body.existing_pic);

    // Get user_id for this student
    db.get('SELECT u.id as user_id FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ?', [studentId], (err, row) => {
        if (err || !row) return res.redirect(`/executive/students/${studentId}/edit?error=ไม่พบนักเรียน`);
        const userId = row.user_id;

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            const updateUserSql = password && password.trim() !== ''
                ? 'UPDATE users SET full_name=?, username=?, password=?, gender=?, profile_pic=? WHERE id=?'
                : 'UPDATE users SET full_name=?, username=?, gender=?, profile_pic=? WHERE id=?';
            const userParams = password && password.trim() !== ''
                ? [full_name, student_code, password, gender, profilePic, userId]
                : [full_name, student_code, gender, profilePic, userId];

            db.run(updateUserSql, userParams, (err) => {
                if (err) { db.run('ROLLBACK'); return res.redirect(`/executive/students/${studentId}/edit?error=อัปเดตข้อมูลไม่สำเร็จ`); }
                db.run('UPDATE students SET classroom_id=?, student_code=? WHERE id=?', [classroom_id, student_code, studentId], (err) => {
                    if (err) { db.run('ROLLBACK'); return res.redirect(`/executive/students/${studentId}/edit?error=อัปเดตห้องเรียนไม่สำเร็จ`); }
                    db.run('COMMIT');
                    res.redirect(`/executive/students/${studentId}/edit?success=อัปเดตข้อมูลนักเรียนเรียบร้อยแล้ว`);
                });
            });
        });
    });
};

// --- Manage Student Details ---

exports.getManageStudent = (req, res) => {
    const studentId = req.params.student_id;

    const queryStudent = `
        SELECT s.id as student_id, u.id as user_id, u.username as student_code,
               u.full_name, u.profile_pic, u.gender, s.classroom_id, c.name as classroom_name
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
