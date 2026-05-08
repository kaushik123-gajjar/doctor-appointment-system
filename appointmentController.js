const Appointment = require('../models/Appointment');
const TimeSlot = require('../models/TimeSlot');
const Doctor = require('../models/Doctor');

// Book appointment
exports.bookAppointment = async (req, res) => {
    try {
        console.log("BODY RECEIVED:", req.body);

        const { doctorId, slotId, patientId } = req.body;

        console.log("doctorId:", doctorId);
        console.log("slotId:", slotId);
        console.log("patientId:", patientId);

        // Check if slotId is a MongoDB ObjectId or a demo slot ID
        const isMongoObjectId = /^[0-9a-fA-F]{24}$/.test(slotId);
        
        let slot = null;
        let appointmentDate = null;
        
        if (isMongoObjectId) {
            // Try to find in database
            slot = await TimeSlot.findById(slotId);
            
            if (!slot) {
                return res.status(400).json({
                    message: 'Slot not found in database'
                });
            }
            
            if (!slot.available) {
                return res.status(400).json({
                    message: 'Slot already booked'
                });
            }
            
            appointmentDate = slot.date;
        } else {
            // For demo slots, extract date from slotId format or generate it
            // Demo slots have format: slot_doctorId_dayOffset_slotNumber
            console.log('Processing demo slot:', slotId);
            
            // We'll use current date + offset for demo slots
            // For now, just use today's date + 1 day
            appointmentDate = new Date();
            appointmentDate.setDate(appointmentDate.getDate() + 1);
            appointmentDate.setHours(0, 0, 0, 0);
        }

        console.log("FOUND SLOT:", slot);
        console.log("Appointment Date:", appointmentDate);

        const appointment = new Appointment({
            patientId,
            doctorId,
            slotId,
            appointmentDate: appointmentDate,
            status: 'Confirmed'
        });

        await appointment.save();

        // Only mark slot as unavailable if it's a database slot
        if (slot) {
            slot.available = false;
            await slot.save();
        }

        res.status(201).json({
            message: 'Appointment booked successfully'
        });

    } catch (error) {
        console.log("FULL ERROR:", error);

        res.status(500).json({
            message: error.message
        });
    }
};

// Get patient appointments
exports.getPatientAppointments = async (req, res) => {
    try {
        const appointments = await Appointment.find({ patientId: req.params.patientId })
            .sort({ appointmentDate: -1 });

        // Load doctors from JSON for demo doctors
        const fs = require('fs');
        const path = require('path');
        const doctorsPath = path.join(__dirname, '../data/doctors.json');
        let jsonDoctors = [];
        
        try {
            if (fs.existsSync(doctorsPath)) {
                const data = fs.readFileSync(doctorsPath, 'utf8');
                jsonDoctors = JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading doctors JSON:', error.message);
        }

        // Format response
        const formattedAppointments = await Promise.all(appointments.map(async (apt) => {
            let doctorInfo = { name: 'Unknown Doctor', specialty: 'N/A' };
            
            // Try to find doctor in JSON first (for demo doctors)
            const jsonDoctor = jsonDoctors.find(d => d._id === apt.doctorId);
            if (jsonDoctor) {
                doctorInfo = { name: jsonDoctor.name, specialty: jsonDoctor.specialty };
            } else {
                // Try database (for real doctors with ObjectId)
                try {
                    const dbDoctor = await Doctor.findById(apt.doctorId)
                        .populate('userId', 'name email phone');
                    if (dbDoctor && dbDoctor.userId) {
                        doctorInfo = { name: dbDoctor.userId.name, specialty: dbDoctor.specialty };
                    }
                } catch (error) {
                    console.log('Doctor not found, using default');
                }
            }

            return {
                _id: apt._id,
                doctorId: doctorInfo,
                slotId: {
                    time: apt.slotId ? apt.slotId.split('_')[3] || 'N/A' : 'N/A',
                    date: apt.appointmentDate
                },
                appointmentDate: apt.appointmentDate,
                status: apt.status
            };
        }));

        res.json(formattedAppointments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get doctor appointments
exports.getDoctorAppointments = async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.params.doctorId });

        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        const appointments = await Appointment.find({ doctorId: doctor._id.toString() })
            .sort({ appointmentDate: -1 });

        // Format response
        const formattedAppointments = appointments.map(apt => ({
            _id: apt._id,
            patientId: apt.patientId,
            doctorId: apt.doctorId,
            slotId: apt.slotId,
            appointmentDate: apt.appointmentDate,
            status: apt.status
        }));

        res.json(formattedAppointments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Cancel appointment
exports.cancelAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findByIdAndUpdate(
            req.params.id,
            { status: 'Cancelled' },
            { new: true }
        );

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Try to make slot available again if it's a database slot (ObjectId format)
        const isMongoObjectId = /^[0-9a-fA-F]{24}$/.test(appointment.slotId);
        if (isMongoObjectId) {
            try {
                await TimeSlot.findByIdAndUpdate(
                    appointment.slotId,
                    { available: true }
                );
            } catch (error) {
                console.log('Could not update slot availability:', error.message);
            }
        }

        res.json({
            message: 'Appointment cancelled successfully',
            appointment
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Reschedule appointment
exports.rescheduleAppointment = async (req, res) => {
    try {
        const { newSlotId } = req.body;
        
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Check if new slot is available (only for database slots)
        const isMongoObjectId = /^[0-9a-fA-F]{24}$/.test(newSlotId);
        
        if (isMongoObjectId) {
            const newSlot = await TimeSlot.findById(newSlotId);
            if (!newSlot || !newSlot.available) {
                return res.status(400).json({ message: 'New slot is not available' });
            }

            // Free up old slot if it's a database slot
            if (/^[0-9a-fA-F]{24}$/.test(appointment.slotId)) {
                await TimeSlot.findByIdAndUpdate(
                    appointment.slotId,
                    { available: true }
                );
            }

            // Update appointment
            appointment.slotId = newSlotId;
            appointment.appointmentDate = newSlot.date;
            await appointment.save();

            // Mark new slot as unavailable
            newSlot.available = false;
            await newSlot.save();
        } else {
            // For demo slots, just update without database lookup
            appointment.slotId = newSlotId;
            await appointment.save();
        }

        res.json({
            message: 'Appointment rescheduled successfully',
            appointment
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get appointment by ID
exports.getAppointmentById = async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate('patientId', 'name email phone');

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Load doctor info from JSON or database
        const fs = require('fs');
        const path = require('path');
        const doctorsPath = path.join(__dirname, '../data/doctors.json');
        let doctorInfo = { name: 'Unknown Doctor', specialty: 'N/A' };
        
        try {
            if (fs.existsSync(doctorsPath)) {
                const data = fs.readFileSync(doctorsPath, 'utf8');
                const jsonDoctors = JSON.parse(data);
                const jsonDoctor = jsonDoctors.find(d => d._id === appointment.doctorId);
                if (jsonDoctor) {
                    doctorInfo = { name: jsonDoctor.name, specialty: jsonDoctor.specialty };
                }
            }
        } catch (error) {
            console.log('Error loading doctor info:', error.message);
        }

        // Try database if not found in JSON
        if (doctorInfo.name === 'Unknown Doctor') {
            try {
                const dbDoctor = await Doctor.findById(appointment.doctorId)
                    .populate('userId', 'name email phone');
                if (dbDoctor && dbDoctor.userId) {
                    doctorInfo = { name: dbDoctor.userId.name, specialty: dbDoctor.specialty };
                }
            } catch (error) {
                console.log('Doctor not found in database');
            }
        }

        res.json({
            ...appointment.toObject(),
            doctorInfo
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
