const db = require('./database');

const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

async function seed() {
    console.log('Seeding KStudent data...');

    // Clear existing data
    await run("DELETE FROM schedules");
    await run("DELETE FROM requests");
    await run("DELETE FROM enrollments");
    await run("DELETE FROM subjects");
    await run("DELETE FROM students");
    await run("DELETE FROM classrooms");
    await run("DELETE FROM users");

    // 1. Create Classrooms
    const classrooms = ['M.1/1', 'M.1/2', 'M.1/3'];
    const classIds = [];
    for (const name of classrooms) {
        const res = await run("INSERT INTO classrooms (name) VALUES (?)", [name]);
        classIds.push(res.lastID);
    }
    console.log('Classrooms created.');

    // 2. Create Staff & Executive
    await run("INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)", ['staff', 'staff', 'staff', 'Registrar Staff']);
    await run("INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)", ['manager', 'manager', 'executive', 'School Director']);

    // 3. Create Teachers (5 Teachers)
    const teachers = [
        { name: 'Somchai Teacher', dept: 'Math' },
        { name: 'Somsri Teacher', dept: 'English' },
        { name: 'Somsak Teacher', dept: 'Science' },
        { name: 'Somying Teacher', dept: 'Thai' },
        { name: 'Sompong Teacher', dept: 'Social' }
    ];
    const teacherIds = [];
    for (const t of teachers) {
        const username = `t_${t.name.split(' ')[0].toLowerCase()}`;
        const res = await run("INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)", [username, 'password', 'teacher', t.name]);
        teacherIds.push(res.lastID);
    }
    console.log('Teachers created.');

    // 4. Create Subjects (30 Subjects)
    const subjectIds = [];
    for (let i = 1; i <= 30; i++) {
        const teacherId = teacherIds[i % teacherIds.length];
        const res = await run("INSERT INTO subjects (code, name, credit, teacher_id) VALUES (?, ?, ?, ?)",
            [`SUB${100 + i}`, `Subject ${i}`, (i % 2 === 0 ? 1.5 : 1.0), teacherId]);
        subjectIds.push(res.lastID);
    }
    console.log('Subjects created.');

    // 5. Create Students (55 Students)
    for (let i = 1; i <= 55; i++) {
        const classId = classIds[i % classIds.length];
        const studentCode = `std${1000 + i}`;
        const fullName = `Student ${i} Nameson`;

        // User
        const userRes = await run("INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)", [studentCode, 'password', 'student', fullName]);

        // Student Record
        const stdRes = await run("INSERT INTO students (user_id, classroom_id, student_code) VALUES (?, ?, ?)", [userRes.lastID, classId, studentCode]);
        const studentId = stdRes.lastID;

        // Enrollments (Random 5 subjects)
        for (let j = 0; j < 5; j++) {
            const subjId = subjectIds[(i + j) % subjectIds.length];
            const mid = Math.floor(Math.random() * 50); // 0-50
            const fin = Math.floor(Math.random() * 50); // 0-50
            const total = mid + fin;
            let grade = 'F';
            if (total >= 80) grade = 'A';
            else if (total >= 70) grade = 'B';
            else if (total >= 60) grade = 'C';
            else if (total >= 50) grade = 'D';

            await run("INSERT INTO enrollments (student_id, subject_id, grade_midterm, grade_final, total_score, grade_char) VALUES (?, ?, ?, ?, ?, ?)",
                [studentId, subjId, mid, fin, total, grade]);
        }
    }
    console.log('Students created.');

    // 6. Create Schedules (Mock)
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const times = ['08:00-09:00', '09:00-10:00', '10:00-11:00', '13:00-14:00'];

    for (const classId of classIds) {
        for (const day of days) {
            for (const time of times) {
                // Random subject
                const subjId = subjectIds[Math.floor(Math.random() * subjectIds.length)];
                await run("INSERT INTO schedules (classroom_id, subject_id, day, time_slot) VALUES (?, ?, ?, ?)",
                    [classId, subjId, day, time]);
            }
        }
    }
    console.log('Schedules created.');

    db.close();
}

seed();
