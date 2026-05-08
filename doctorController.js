const Doctor = require('../models/Doctor');
const User = require('../models/User');
const TimeSlot = require('../models/TimeSlot');
const fs = require('fs');
const path = require('path');

// Load doctors from JSON
const loadDoctorsFromJSON = () => {
    try {
        const dataPath = path.join(__dirname, '../data/doctors.json');
        console.log('Loading doctors from:', dataPath);
        
        if (!fs.existsSync(dataPath)) {
            console.error('Doctors JSON file not found at:', dataPath);
            return [];
        }
        
        const data = fs.readFileSync(dataPath, 'utf8');
        const doctors = JSON.parse(data);
        console.log(`Successfully loaded ${doctors.length} doctors from JSON`);
        return doctors;
    } catch (error) {
        console.error('Error loading doctors JSON:', error.message);
        return [];
    }
};

// Get all doctors
exports.getAllDoctors = async (req, res) => {
    try {
        // First try to get from database
        const dbDoctors = await Doctor.find({ isApproved: true })
            .populate('userId', 'name email phone');
        
        if (dbDoctors.length > 0) {
            console.log(`Returning ${dbDoctors.length} doctors from database`);
            return res.json(dbDoctors);
        }
        
        // If no doctors in DB, load from JSON
        console.log('No doctors in database, loading from JSON...');
        const jsonDoctors = loadDoctorsFromJSON();
        
        if (jsonDoctors.length === 0) {
            console.warn('No doctors found in JSON either');
            return res.status(200).json([]);
        }
        
        res.json(jsonDoctors);
    } catch (error) {
        console.error('Error in getAllDoctors:', error.message);
        // Fallback to JSON if database fails
        const jsonDoctors = loadDoctorsFromJSON();
        res.json(jsonDoctors);
    }
};

// Get doctor by ID
exports.getDoctorById = async (req, res) => {
    try {
        // Try database first
        const doctor = await Doctor.findById(req.params.id)
            .populate('userId', 'name email phone');

        if (doctor) {
            const doctorData = {
                _id: doctor._id,
                name: doctor.userId.name,
                email: doctor.userId.email,
                phone: doctor.userId.phone,
                specialty: doctor.specialty,
                experience: doctor.experience,
                consultationFee: doctor.consultationFee,
                clinic: doctor.clinic,
                rating: doctor.rating
            };
            return res.json(doctorData);
        }

        // If not in database, try JSON
        const jsonDoctors = loadDoctorsFromJSON();
        const jsonDoctor = jsonDoctors.find(d => d._id === req.params.id);
        
        if (jsonDoctor) {
            return res.json(jsonDoctor);
        }

        res.status(404).json({ message: 'Doctor not found' });
    } catch (error) {
        // Fallback to JSON
        const jsonDoctors = loadDoctorsFromJSON();
        const jsonDoctor = jsonDoctors.find(d => d._id === req.params.id);
        
        if (jsonDoctor) {
            return res.json(jsonDoctor);
        }
        
        res.status(500).json({ message: error.message });
    }
};

// Get available slots for a doctor
exports.getDoctorSlots = async (req, res) => {
    try {
        const doctorId = req.params.id;
        console.log('Getting slots for doctor ID:', doctorId);
        
        // Generate slots in-memory for demo doctors (non-ObjectId format)
        // This allows the system to work with both DB doctors and demo doctors
        const isMongoObjectId = /^[0-9a-fA-F]{24}$/.test(doctorId);
        
        if (!isMongoObjectId) {
            // For demo doctors with string IDs, generate slots in-memory
            console.log('Generating slots for demo doctor:', doctorId);
            const generatedSlots = generateSampleSlots(doctorId);
            return res.json(generatedSlots);
        }
        
        // For MongoDB doctors, try to fetch from database
        const slots = await TimeSlot.find({
            doctorId: doctorId,
            date: { $gte: new Date() }
        }).sort({ date: 1, time: 1 });

        // If slots found in DB, return them
        if (slots.length > 0) {
            console.log(`Found ${slots.length} slots in database`);
            return res.json(slots);
        }

        // If no slots exist, create them
        console.log('No slots found, generating and saving...');
        const generatedSlots = generateSampleSlots(doctorId);
        const savedSlots = await TimeSlot.insertMany(generatedSlots);
        console.log(`Generated and saved ${savedSlots.length} slots`);
        res.json(savedSlots);
    } catch (error) {
        console.error('Error fetching/creating slots:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// Generate sample time slots
const generateSampleSlots = (doctorId) => {
    const slots = [];
    const times = ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM'];
    let slotCounter = 0;
    
    // Generate slots for next 7 days
    for (let i = 1; i <= 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        date.setHours(0, 0, 0, 0); // Reset time to start of day
        
        // Only weekdays
        if (date.getDay() !== 0 && date.getDay() !== 6) {
            times.forEach((time) => {
                slotCounter++;
                slots.push({
                    _id: `slot_${doctorId}_${i}_${slotCounter}`,
                    doctorId: doctorId,
                    date: new Date(date),
                    time: time,
                    available: true
                });
            });
        }
    }
    
    console.log(`Generated ${slots.length} sample slots for doctor ${doctorId}`);
    return slots;
};

// Create doctor profile
exports.createDoctorProfile = async (req, res) => {
    try {
        const { specialty, experience, consultationFee, clinic } = req.body;

        const doctor = new Doctor({
            userId: req.user.id,
            specialty,
            experience,
            consultationFee,
            clinic,
            isApproved: false
        });

        await doctor.save();

        res.status(201).json({
            message: 'Doctor profile created. Waiting for admin approval.',
            doctor
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Add time slots
exports.addTimeSlots = async (req, res) => {
    try {
        const { dates, times } = req.body;
        const doctorId = req.params.id;

        const slots = [];
        for (let date of dates) {
            for (let time of times) {
                const slot = new TimeSlot({
                    doctorId,
                    date: new Date(date),
                    time,
                    available: true
                });
                await slot.save();
                slots.push(slot);
            }
        }

        res.status(201).json({
            message: 'Time slots added successfully',
            slots
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update doctor profile
exports.updateDoctorProfile = async (req, res) => {
    try {
        const { specialty, experience, consultationFee, clinic } = req.body;

        const doctor = await Doctor.findByIdAndUpdate(
            req.params.id,
            { specialty, experience, consultationFee, clinic },
            { new: true }
        );

        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        res.json({
            message: 'Doctor profile updated',
            doctor
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
