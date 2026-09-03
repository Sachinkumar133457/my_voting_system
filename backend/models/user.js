const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { 
        type: String 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: { 
        type: String 
    },
    otp: { 
        type: String 
    },
    otpExpires: { 
        type: Date 
    },
    isVerified: { 
        type: Boolean, 
        default: false 
    },
    hasVoted: { 
        type: Boolean, 
        default: false 
    },
    votedCandidateId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Candidate', 
        default: null 
    }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);