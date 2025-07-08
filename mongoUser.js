const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const Server = require("./serverSchema.js");
const User = require("./userSchema.js");
const app = express();
app.use(bodyParser.json());
const { v4: uuidv4 } = require("uuid");

const mongoURL =
  "";

mongoose
  .connect(mongoURL)
  .then(() => console.log("Successfully connected to MongoDB Atlas!"))
  .catch((err) => console.error("MongoDB connection error:", err));

const checkIfUserHasAccess = async (serverId, username) => {  
  try {
    const server = await Server.findById(serverId);
    if(!server) {
      return;
    }

    const hasAccessToRead = server.permits.permitsToRead;
    const hasReadAccess = hasAccessToRead.includes(username);
    
    const hasAccessToPost = server.permits.permitsToPost;
    const hasPostAccess = hasAccessToPost.includes(username);
    
    const hasAccessToKick = server.permits.permitsToKick;
    const hasKickAccess = hasAccessToKick.includes(username);
    return {'hasReadAccess' : hasReadAccess, 'hasPostAccess': hasPostAccess, 'hasKickAccess': hasKickAccess}

  } catch(err) {
    console.log("Error happened while checking access: ", err)
  }
} 

const onUserNameChange = async (serverId, userId, newUsername) => {
  try {
    const server = await Server.findById(serverId);
    if (!server) {
      console.log("Server not found");
      return;
    }

    const userExists = server.users.some(user => user.id === userId);
    if (!userExists) {
      console.log("User not found in the server");
      return;
    }

    const currentUsername = server.users.filter(user => user.id === userId)[0]?.username;

    const updateUsername = await Server.findOneAndUpdate(
      { _id: serverId, "users.id": userId },
      { $set: { "users.$.username": newUsername } },
      { new: true, useFindAndModify: false }
    );

    if (updateUsername) {
     onUserNameChangeUpdateMessages(serverId, currentUsername, newUsername)
      console.log("Username updated successfully:", updateUsername);
    } else {
      console.log("Update failed");
    }
  } catch (err) {
    console.error("Error updating name: ", err.message);
  }
};

const onUserNameChangeUpdateMessages = async (serverId,username,newUsername) => {
  try {
    const server = await Server.findById(serverId);
    if(!server) {
      return;
    }
    let updatedMessages = server.messages.map(message => {
      if(message.user === username) {
        message.user = newUsername
      }
      return message; 
    })
    server.messages = updatedMessages;
    const updateServerMessages = await server.save();

    console.log('New username successfully updated:', updateServerMessages)
  } catch (err) {
    console.error("Error updating name from older messages: ", err.message);
  }
};

const insertNewUser = async (name, username, googleToken, socket) => {
  const userUuid = uuidv4();
  const newUser = new User({
    _id: `user/id/${userUuid}`,
    name: name,
    username: username,
    servers: [],
    recentMessages: {},
    token: googleToken,
    socket: socket,
  })

  try {
    const savedUser = await newUser.save();
    console.log("User saved successfully: ", savedUser);
  } catch(err) {
    console.log("Error saving new user: ", err.message);
  }
  finally{
    mongoose.connection.close();
  }
};

