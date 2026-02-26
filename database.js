const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'kstudent.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database ' + dbPath + ': ' + err.message);
    } else {
        console.log('Connected to the SQLite database (KStudent).');
    }
});

db.serialize(() => {
    // 1. Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('student', 'teacher', 'staff', 'executive')) NOT NULL,
        full_name TEXT NOT NULL,
        profile_pic TEXT,
        gender TEXT,
        homeroom_classroom_id INTEGER
    )`);

    db.run(`ALTER TABLE users ADD COLUMN homeroom_classroom_id INTEGER`, (err) => {
        // Ignore error if column already exists
    });
    db.run(`ALTER TABLE users ADD COLUMN profile_pic TEXT`, (err) => { });
    db.run(`ALTER TABLE users ADD COLUMN gender TEXT`, (err) => { });


    // 2. Classrooms Table
    db.run(`CREATE TABLE IF NOT EXISTS classrooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL, -- e.g., 'M.1/1'
        homeroom_teacher_id INTEGER
    )`);

    db.run(`ALTER TABLE classrooms ADD COLUMN homeroom_teacher_id INTEGER`, (err) => {
        // Ignore error if column already exists
    });

    // 2.5 Homeroom Teachers (Many-to-Many)
    db.run(`CREATE TABLE IF NOT EXISTS homeroom_teachers (
        teacher_id INTEGER,
        classroom_id INTEGER,
        PRIMARY KEY (teacher_id, classroom_id),
        FOREIGN KEY(teacher_id) REFERENCES users(id),
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id)
    )`);


    // 3. Students Table
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        classroom_id INTEGER,
        student_code TEXT UNIQUE,
        behavior_score INTEGER DEFAULT 100,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id)
    )`);

    // 4. Subjects Table
    db.run(`CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        credit REAL NOT NULL,
        teacher_id INTEGER, -- Links to a user with role 'teacher'
        FOREIGN KEY(teacher_id) REFERENCES users(id)
    )`);

    // 5. Enrollments Table (Grades)
    db.run(`CREATE TABLE IF NOT EXISTS enrollments (
        student_id INTEGER,
        subject_id INTEGER,
        grade_midterm REAL DEFAULT 0,
        grade_final REAL DEFAULT 0,
        total_score REAL DEFAULT 0,
        grade_char TEXT, -- A, B+, etc.
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        academic_year TEXT DEFAULT '2567',
        semester TEXT DEFAULT '1',
        recorded_by INTEGER,
        PRIMARY KEY (student_id, subject_id, academic_year, semester),
        FOREIGN KEY(student_id) REFERENCES students(id),
        FOREIGN KEY(subject_id) REFERENCES subjects(id),
        FOREIGN KEY(recorded_by) REFERENCES users(id)
    )`);
    db.run(`ALTER TABLE enrollments ADD COLUMN recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => { });
    db.run(`ALTER TABLE enrollments ADD COLUMN academic_year TEXT DEFAULT '2567'`, (err) => { });
    db.run(`ALTER TABLE enrollments ADD COLUMN semester TEXT DEFAULT '1'`, (err) => { });
    db.run(`ALTER TABLE enrollments ADD COLUMN recorded_by INTEGER`, (err) => { });


    // 5.5 Grade Logs Table (for Transactional Grade changes)
    db.run(`CREATE TABLE IF NOT EXISTS grade_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        subject_id INTEGER,
        action TEXT NOT NULL,
        old_grade_midterm REAL,
        new_grade_midterm REAL,
        old_grade_final REAL,
        new_grade_final REAL,
        academic_year TEXT,
        semester TEXT,
        recorded_by INTEGER,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(student_id) REFERENCES students(id),
        FOREIGN KEY(subject_id) REFERENCES subjects(id),
        FOREIGN KEY(recorded_by) REFERENCES users(id)
    )`);

    // 5.6 Behavior Logs Table
    db.run(`CREATE TABLE IF NOT EXISTS behavior_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        score_change INTEGER NOT NULL,
        reason TEXT NOT NULL,
        recorded_by INTEGER,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(student_id) REFERENCES students(id),
        FOREIGN KEY(recorded_by) REFERENCES users(id)
    )`);

    // 6. Requests/Petitions Table
    db.run(`CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        topic TEXT NOT NULL,
        description TEXT,
        attachment_url TEXT,
        status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected')),
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        reply TEXT, -- Staff/Teacher reply
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
    db.run(`ALTER TABLE requests ADD COLUMN attachment_url TEXT`, (err) => { });

    // 7. Schedules Table
    db.run(`CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        classroom_id INTEGER,
        subject_id INTEGER,
        day TEXT CHECK(day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
        time_slot TEXT, -- e.g., '08:00-09:00'
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id),
        FOREIGN KEY(subject_id) REFERENCES subjects(id)
    )`);

    // 8. Announcements Table
    db.run(`CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT,
        target_audience TEXT DEFAULT 'both' CHECK(target_audience IN ('student', 'teacher', 'both')),
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(id)
    )`);
    db.run(`ALTER TABLE announcements ADD COLUMN description TEXT`, (err) => { /* ignore if exists */ });
});

module.exports = db;
