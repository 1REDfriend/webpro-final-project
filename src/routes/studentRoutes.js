const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { isAuthenticated, hasRole } = require('../middleware/authMiddleware');

const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.use(isAuthenticated, hasRole('student'));

router.get('/dashboard', studentController.getDashboard);
router.get('/grades', studentController.getGrades);
router.get('/schedule', studentController.getSchedule);
router.get('/requests', studentController.getRequests);
router.post('/requests', upload.single('attachment'), studentController.postRequest);
router.post('/requests/cancel', studentController.cancelRequest);
router.get('/announcements', studentController.getAllAnnouncements);
router.get('/announcements/:id', studentController.getAnnouncementDetail);
router.get('/transcript/download', studentController.downloadTranscript);
router.get('/behavior-history', studentController.getBehaviorHistory);

module.exports = router;
