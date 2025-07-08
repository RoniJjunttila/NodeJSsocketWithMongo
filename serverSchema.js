const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema({
  user: { type: String, required: true },
  timestamp: { type: Date, required: true },
  bMediaExists: { type: Boolean, required: true },
  text: { type: String, required: true },
  media: { type: String, required: false }
});

const userSchema = new Schema({
  _id: { type: String, required: true},
  username: { type: String, required: true } 
});

const permitsSchema = new Schema({
  permitsToRead: {type: [String], required: true},
  permitsToPost: { type: [String], required: true },
  permitsToKick: { type: [String], required: true }
});

const serverSchema = new Schema({
  _id: { type: String, required: true},
  name: { type: String, required: true},
  messages: [messageSchema],
  users: [userSchema],
  permits: permitsSchema,
  maxNumberOfUsers: { type: Number }
});

const Server = mongoose.model('Server', serverSchema);

module.exports = Server;