const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'sdms.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database ' + dbPath + ': ' + err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT CHECK(role IN ('admin', 'student', 'teacher', 'staff', 'manager')),
        name TEXT
    )`);

    // Classes Table
    db.run(`CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        level INTEGER
    )`);

    // Teachers Table
    db.run(`CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        department TEXT,
        homeroom_class_id INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(homeroom_class_id) REFERENCES classes(id)
    )`);

    // Students Table
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        student_code TEXT UNIQUE,
        class_id INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(class_id) REFERENCES classes(id)
    )`);

    // Subjects Table
    db.run(`CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        name TEXT,
        credit REAL,
        teacher_id INTEGER,
        FOREIGN KEY(teacher_id) REFERENCES teachers(id)
    )`);

    // Enrollments (Grades) Table
    db.run(`CREATE TABLE IF NOT EXISTS enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        subject_id INTEGER,
        score INTEGER DEFAULT 0,
        grade TEXT,
        semester INTEGER,
        year INTEGER,
        FOREIGN KEY(student_id) REFERENCES students(id),
        FOREIGN KEY(subject_id) REFERENCES subjects(id)
    )`);

    // Behaviors Table
    db.run(`CREATE TABLE IF NOT EXISTS behaviors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        score_change INTEGER,
        reason TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        teacher_id INTEGER,
        FOREIGN KEY(student_id) REFERENCES students(id),
        FOREIGN KEY(teacher_id) REFERENCES teachers(id)
    )`);

    // Requests Table
    db.run(`CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER,
        type TEXT,
        details TEXT,
        status TEXT DEFAULT 'Pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        response TEXT,
        FOREIGN KEY(sender_id) REFERENCES users(id)
    )`);
});

module.exports = db;
