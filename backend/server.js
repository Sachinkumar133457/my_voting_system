const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const User = require('./models/User');
const Candidate = require('./models/Candidate');
const auth = require('./middleware/auth');

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected Successfully!'))
    .catch(err => console.log('DB Connection Error:', err));

// Google OAuth Client Setup
const client = new OAuth2Client("861443712292-mmiiijbula8ujmbnp2trfhl4gbif5phv.apps.googleusercontent.com");

// Nodemailer Transporter Setup (Use Gmail App Password)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Aapka Gmail ID (e.g. example@gmail.com)
        pass: process.env.EMAIL_PASS  // Aapka Gmail 16-Digit App Password
    }
});

// Candidate Initial Seeding
async function seedCandidates() {
    try {
        const count = await Candidate.countDocuments();
        if (count === 0) {
            await Candidate.insertMany([
                { name: "Candidate A", party: "Progressive Party", votes: 5428 },
                { name: "Candidate B", party: "National Democratic Alliance", votes: 4327 },
                { name: "Candidate C", party: "United Liberty Party", votes: 2848 }
            ]);
            console.log("Default Candidates Seeded!");
        }
    } catch (err) {
        console.log("Seeding Error:", err);
    }
}
seedCandidates();

// ---------------- REST APIs ----------------

// 📧 1. REAL GMAIL OTP SENDING API
app.post('/api/auth/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: 'Email address zaroori hai!' });

    try {
        // Generate Random 6-Digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry

        let user = await User.findOne({ email });
        if (!user) {
            user = new User({ email, otp, otpExpires, isVerified: false });
        } else {
            user.otp = otp;
            user.otpExpires = otpExpires;
        }
        await user.save();

        // Email Payload
        const mailOptions = {
            from: `"VoteNow Security" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'VoteNow Account Verification Code (OTP)',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eef2f6; border-radius: 10px;">
                    <h2 style="color: #1d5cff;">VoteNow Verification</h2>
                    <p>Aapka Voting Verification OTP code niche diya gaya hai:</p>
                    <h1 style="background: #f1f5f9; width: fit-content; padding: 10px 20px; border-radius: 8px; letter-spacing: 4px; color: #071b3a;">${otp}</h1>
                    <p>Ye OTP 10 minute me expire ho jayega. Kisi ke sath share na karein.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ msg: 'OTP aapke Real Gmail ID par bhej diya gaya hai!' });

    } catch (err) {
        console.error("Mail Error:", err);
        res.status(500).json({ msg: 'Gmail OTP Bhejne me error aaya! Nodemailer credentials check karein.' });
    }
});

// 🔑 2. REGISTER USER (OTP Verification & Account Save)
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, otp } = req.body;
    try {
        let user = await User.findOne({ email });
        if (!user || user.otp !== otp) {
            return res.status(400).json({ msg: 'Galat OTP! Kripya sahi OTP dalein.' });
        }

        if (user.otpExpires < new Date()) {
            return res.status(400).json({ msg: 'OTP Expire ho gaya hai! Dobara request karein.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user.name = name;
        user.password = hashedPassword;
        user.isVerified = true;
        user.otp = undefined; // Clear OTP
        user.otpExpires = undefined;

        await user.save();
        res.status(201).json({ msg: 'Registration Successful! Ab Login karein.' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// 🔐 3. LOGIN API
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || !user.password) return res.status(400).json({ msg: 'Invalid Credentials!' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials!' });

        const token = jwt.sign(
            { id: user._id, name: user.name, hasVoted: user.hasVoted },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({ token, user: { name: user.name, email: user.email, hasVoted: user.hasVoted } });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// 🌐 7. GOOGLE SIGN-IN API
app.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: "861443712292-mmiiijbula8ujmbnp2trfhl4gbif5phv.apps.googleusercontent.com"
        });
        const { name, email } = ticket.getPayload();

        let user = await User.findOne({ email });
        if (!user) {
            user = new User({ name, email, isVerified: true });
            await user.save();
        }

        const jwtToken = jwt.sign(
            { id: user._id, name: user.name, hasVoted: user.hasVoted },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({ token: jwtToken, user: { name: user.name, email: user.email, hasVoted: user.hasVoted } });
    } catch (err) {
        console.error("Google Auth Error:", err);
        res.status(400).json({ msg: 'Google Authentication Failed!' });
    }
});

// 📊 4. CANDIDATES LIST
app.get('/api/candidates', async (req, res) => {
    try {
        const candidates = await Candidate.find();
        res.json(candidates);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// 🗳️ 5. CAST VOTE API
app.post('/api/vote', auth, async (req, res) => {
    const { candidateId } = req.body;
    try {
        const user = await User.findById(req.user.id);
        if (user.hasVoted) return res.status(400).json({ msg: 'Aap pehle hi vote cast kar chuke hain!' });

        const candidate = await Candidate.findById(candidateId);
        if (!candidate) return res.status(404).json({ msg: 'Candidate nahi mila!' });

        candidate.votes += 1;
        await candidate.save();

        user.hasVoted = true;
        user.votedCandidateId = candidateId;
        await user.save();

        res.json({ msg: 'Vote successfully cast ho gaya hai!' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// 📈 6. LIVE RESULTS
app.get('/api/results', async (req, res) => {
    try {
        const candidates = await Candidate.find();
        const totalVotes = candidates.reduce((acc, curr) => acc + curr.votes, 0);
        res.json({ totalVotes, candidates });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend Server Running on Port ${PORT}`));