const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  phone: String,
  password: String,
  role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user' 
  }
});

module.exports = mongoose.model('User', userSchema);
