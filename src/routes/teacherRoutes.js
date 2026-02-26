const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { isAuthenticated, hasRole } = require('../middleware/authMiddleware');

const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.use(isAuthenticated, hasRole('teacher'));

router.get('/dashboard', teacherController.getDashboard);
router.post('/subjects', teacherController.addSubject);
router.post('/homeroom', teacherController.selectHomeroom);
router.get('/classes', teacherController.getClasses);
router.get('/student/:id/grades', teacherController.getStudentGrades);
router.post('/behavior', teacherController.updateBehavior);
router.post('/grade', teacherController.updateGrade);
router.get('/requests', teacherController.getRequests);
router.post('/requests', upload.single('attachment'), teacherController.postRequest);

// CSV Routes
router.get('/grades/export', teacherController.downloadGradesCSV);
router.post('/grades/import', upload.single('csv_file'), teacherController.uploadGradesCSV);
router.get('/schedule', teacherController.getSchedule);

module.exports = router;
