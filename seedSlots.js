const mongoose = require('mongoose');
const dotenv = require('dotenv');
const TimeSlot = require('./models/TimeSlot');
const Doctor = require('./models/Doctor');

dotenv.config();

const seedSlots = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to MongoDB');
        
        // Get all doctors
        const doctors = await Doctor.find();
        console.log(`Found ${doctors.length} doctors in database`);
        
        if (doctors.length === 0) {
            console.log('ℹ️ No doctors found. Skipping slot seeding.');
            await mongoose.connection.close();
            return;
        }
        
        // Clear existing slots
        const deletedCount = await TimeSlot.deleteMany({});
        console.log(`🗑️ Deleted ${deletedCount.deletedCount} existing time slots`);
        
        // Generate slots for each doctor
        const times = [
            '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
            '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM'
        ];
        
        let totalSlotsCreated = 0;
        
        for (const doctor of doctors) {
            const slots = [];
            
            // Generate slots for next 30 days
            for (let i = 1; i <= 30; i++) {
                const date = new Date();
                date.setDate(date.getDate() + i);
                date.setHours(0, 0, 0, 0);
                
                // Only create slots for weekdays
                if (date.getDay() !== 0 && date.getDay() !== 6) {
                    times.forEach(time => {
                        slots.push({
                            doctorId: doctor._id,
                            date: new Date(date),
                            time: time,
                            available: true
                        });
                    });
                }
            }
            
            // Save slots
            const savedSlots = await TimeSlot.insertMany(slots);
            console.log(`✅ Created ${savedSlots.length} slots for Dr. ${doctor._id}`);
            totalSlotsCreated += savedSlots.length;
        }
        
        console.log(`\n✅ Total time slots created: ${totalSlotsCreated}`);
        console.log('✅ Slot seeding completed successfully!');
        
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
        
    } catch (error) {
        console.error('❌ Error seeding slots:', error.message);
        process.exit(1);
    }
};

// Run the seed function
seedSlots();
