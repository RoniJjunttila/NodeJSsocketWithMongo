const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  servers: { type: [String], required: true },
  recentMessages: {
    type: Map,
    of: [String],
    default: {}
  },
  lastSeen: {type: Date, required: false},
  birthday: {type: Date, required: true},
  sendMessageCount: { type: Number, default: 0 }, 
  sendMediaCount: { type: Number, default: 0 },
});

const User = mongoose.model('User', userSchema);

module.exports = User;