const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { isAuthenticated, hasRole } = require('../middleware/authMiddleware');

router.use(isAuthenticated, hasRole('staff'));

router.get('/dashboard', staffController.getDashboard);
router.post('/request-update', staffController.updateRequestStatus);

// Announcement routes (modal on dashboard)
router.post('/announcements', staffController.createAnnouncement);
router.post('/announcements/edit', staffController.editAnnouncement);
router.post('/announcements/delete', staffController.deleteAnnouncement);

module.exports = router;
