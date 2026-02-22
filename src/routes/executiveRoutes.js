const express = require('express');
const router = express.Router();
const executiveController = require('../controllers/executiveController');
const { isAuthenticated, hasRole } = require('../middleware/authMiddleware');

router.use(isAuthenticated, hasRole('executive'));

router.get('/dashboard', executiveController.getDashboard);

// Teacher Management Routes
router.get('/teachers', executiveController.getTeachers);
router.post('/teachers', executiveController.addTeacher);
router.post('/teachers/delete', executiveController.deleteTeacher);

// Student Management Routes
router.get('/students', executiveController.getStudents);
router.post('/students', executiveController.addStudent);
router.post('/students/delete', executiveController.deleteStudent);

module.exports = router;
