const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    doctorId: {
        type: String,
        required: true
    },

    slotId: {
        type: String,
        required: true
    },

    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    appointmentDate: {
        type: Date,
        required: true
    },

    status: {
        type: String,
        enum: ['booked', 'Confirmed', 'completed', 'Cancelled', 'cancelled'],
        default: 'Confirmed'
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Appointment', appointmentSchema);