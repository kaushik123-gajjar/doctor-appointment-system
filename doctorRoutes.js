const express = require('express');
const router = express.Router();
const {
    getAllDoctors,
    getDoctorById,
    getDoctorSlots,
    createDoctorProfile,
    addTimeSlots,
    updateDoctorProfile
} = require('../controllers/doctorController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/', getAllDoctors);
router.get('/:id', getDoctorById);
router.get('/:id/slots', getDoctorSlots);

// Protected routes
router.post('/', protect, authorize('doctor'), createDoctorProfile);
router.put('/:id', protect, authorize('doctor'), updateDoctorProfile);
router.post('/:id/slots', protect, authorize('doctor'), addTimeSlots);

module.exports = router;
