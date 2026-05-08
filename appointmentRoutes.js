const express = require('express');
const router = express.Router();
const {
    bookAppointment,
    getPatientAppointments,
    getDoctorAppointments,
    cancelAppointment,
    rescheduleAppointment,
    getAppointmentById
} = require('../controllers/appointmentController');
const { protect } = require('../middleware/auth');

// Protected routes
router.post('/book', protect, bookAppointment);
router.get('/patient/:patientId', protect, getPatientAppointments);
router.get('/doctor/:doctorId', protect, getDoctorAppointments);
router.get('/:id', protect, getAppointmentById);
router.put('/:id/cancel', protect, cancelAppointment);
router.put('/:id/reschedule', protect, rescheduleAppointment);

module.exports = router;
