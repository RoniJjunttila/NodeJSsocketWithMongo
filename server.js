const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const desktopScreenshot = require("desktop-screenshot");
const fs = require("fs");
const path = require("path");
const admin = require('firebase-admin');
require('dotenv').config(); 
let serviceAccount = require("./yotta-63764-firebase-adminsdk-jj2o4-dc1a67a21d.json");
const routes = require('./S3_Uploader.js');
const { getMediaFromBucket } = require('./S3_key_signer.js');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

/* node --env-file=.env S3_Uploader.js  // xxx to run with env variables*/

const app = express();
const server = http.createServer(app);
/* server,{

} */

/* EC2 muista jättää app.listen port 80  */

/* 
Socket.io has a message size limit: see option maxHttpBufferSize in the docs at https://socket.io/docs/v4/server-options/#maxhttpbuffersize . 
You can increase this limit, but keep in mind that parsing images as JSON is not very efficient. 
In the long term, consider uploading the images separately - a common solution is to use HTTP POST, obtain the uploaded URL, and send that to the recipient instead. 
This is more complex, but avoids the message size problem entirely, as file uploads can be of any size and still be streamed in an efficient manner.
 */

/* 
*******************************************
*****************************************
***************************************
*************************************
***********************************
socket.emit() send data from the server to specific(socket owner) client
or 
  const clientSocket = io.sockets.connected[socketID]; 
  clientSocket.emit
  emit to this socket id
io.emit() / socket.broadcast.emit send data to all connected ClientRequest, broadcast excludes sender
io.to.room.emit send data to all clients in this room  
io.of(namespace).emit organze sockets to gropus  
**********************************
***********************************
************************************
*************************************
**************************************
*/

//permission ongelma edelleen
//admin ongelma ei permission

//users paneelin tyypit tulee actiivisesta socketista mut vois filteröidä mielummin vaikka users kautta jolloin socketilla ei oo väliä ja näkyy offline ukotki

//Mieti socket.userId käyttämist kaikkialla

//timeout

//trycatch kaikkeen!!!!!!!!!!!

//Täytyy molemmilla tehdä huone ennen kuin voi laittaa ädd friend muuten cräshää

//jostain syystä user täytyy tehdä oma huone ennen kuin voi invite toiseen huoneesee??? Alempi palauttaa undefined jos user ei oo tehny oma huonetta socket.userId = socket.userId || uuidv4(); ei oo uuid jos serveri on kaatunu tms?  ehkä korjattu? 15.2
/* 
let addableUserSocketKey = Object.keys(users).find(
  (id) => users[id].name.trim().toLowerCase() === name.trim().toLowerCase()
); */

// Explicitly set cors options for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*",
  },
  maxHttpBufferSize: 1e7
});

const rooms = {
  room1: { messages: [], users: {} },
};

const { v4: uuidv4 } = require("uuid");

app.use(express.json());
app.use(cors());
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));
app.use(routes);
const users = {}; // Store user names with their corresponding socket IDs

io.on("connection", (socket) => {
  console.log("A user connected");
  console.log(users)
  //socket.emit("availableRooms", Object.keys(rooms));

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
  // Set a unique user ID for each connected user
  socket.userId = "";
  ///käyttäjät katoaa kun disconnect
  socket.on("getRooms", (name, firebaseToken) => {

    Object.values(users).filter(user => {
      if(user.name === name) {
        user.socketID = socket.id;
      }
    }).socketID = socket.id;
    Object.values(users).forEach((user) => {
      if (user.name === name) {
        console.log("getrooms started")

        const findUserID = Object.keys(users).filter((key) => {
          const user = users[key];
          return user.name === name && user.socketID === socket.id;
        });
       // console.log(findUserID)
       //If user exists then =>> 
        if(findUserID[0]) {
          socket.userId = findUserID[0]
     
          let userServers = user.servers;
          user.token = firebaseToken
          console.log(user)
            let availableServers = Object.keys(rooms).filter((roomId) =>
              userServers.includes(roomId)
            ); //tästä saa id
            const filteredRoomNames = Object.keys(rooms)
              .filter((roomId) => userServers.includes(roomId))
              .map((roomId) => rooms[roomId].name);
            console.log("Same info used");
            socket.emit("availableRooms", availableServers, filteredRoomNames);   
        } 
      }
    });
  });

  socket.on("addUserToRoom", (room, userName, name) => {
   //console.log(room)
  // console.log(userName)
  //  console.log(userName)
   //console.log(Object.keys(rooms).find(key => rooms[key].name === room)) // server id ei toimi
   // console.log(`has permission: ${Object.keys(users).find(key => users[key].name === userName)}`) // user id? 

  //  const roomId = Object.keys(rooms).find(key => rooms[key].name === room)
//    const permits = users[adminId].permits[room];
  //  console.log(permits)
   // const hasPermission = users[adminId].permits[room].hasPermitToKick
   // console.log("room name "+ room)
  //  console.log(adminId)
  //  console.log(users[adminId].permits[roomId].hasPermitToKick)
  //  console.log(users)

  try {
    let addableUserSocketKey = Object.keys(users).find(
      (id) => users[id].name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    const adminId = Object.keys(users).find(key => users[key].name === userName)
    const hasPermission = users[adminId].permits[room].hasPermitToKick
    if (
      addableUserSocketKey &&
      hasPermission
    ) { //users[socket.userId].permits[room].hasPermitToKick
      //permit to kick means user has admin permits
      let addableUserSocket = users[addableUserSocketKey];
      //console.log(addableUserSocketKey);
      //console.log(addableUserSocket.servers);
      addableUserSocket.servers.push(room);
      addableUserSocket.recentMessages = {};
      addableUserSocket.permits[room] = {
        hasPermitToPost: true,
        hasPermitToKick: false,
      };
/*      Object.values(users).forEach((user) => {
      console.log(user)
     }) */
      updateServersToUsers(room);
    } else {
      // If the user doesn't have the permit to kick, send a message back to the user
      socket.emit(
        "permissionDenied",
        "You don't have the permission to invite users to this room."
      );
    }
    // console.log(users)
    //   users[addableUserSocket].servers.push(room) 
  }
  catch(e){
    console.log("error occured in addUserToRoom. Error:" + e)
  }
  });

  socket.on("onRemovePeopleFromServer", (room, name, username) => {
   // console.log(users[socket.userId].permits[room].hasPermitToKick)
    if (users[socket.userId].permits[room].hasPermitToKick) {
      for (const userId in users) {
        if (users[userId].name === name) {
          // If found, log the user ID or access other properties as needed
          // console.log('User ID:', userId);
          //  console.log('Servers:', users[userId].servers.includes(room));
          if (users[userId].servers.includes(room)) {
            const serverIndex = users[userId].servers.indexOf(room);
            users[userId].servers.splice(serverIndex, 1);
            serversThatAreAvailable();
          }
        }
      }
    } else {
      if (username === name) {       
        for(const [userid, userinfo] of Object.entries(users)) {
          if(userinfo.name === name && username === name) {
            console.log(            users[userid])
            const serverIndex = users[userid].servers.indexOf(room);
            users[userid].servers.splice(serverIndex, 1);
            delete users[userid].permits[room] // Removes permit from object
            serversThatAreAvailable();
          }
        }
      }
    }
  });

  /////////////////////täällä pitäs chekkaa onko semmonen kamu jo olemassa
  //add new friend
  socket.on("addNewFriend", (usernameToAdd, username) => {
    try {
      const newRoomName = "DM" + username.toString() + "/" + uuidv4();

      function findUserIdByName(user) {
        for (const [userId, userInfo] of Object.entries(users)) {
          if (userInfo.name === user) {
            return userId;
          }
        }
        return null; 
      }
    
      client01 = users[findUserIdByName(username)];
      client02 = users[findUserIdByName(usernameToAdd)];

      /* function createBaseUserTemplate(username) {
        const findUserID = Object.keys(users).filter(key => {
          const user = users[key];
          return user.name === username && user.socketID === socket.id;
        });
    
        socket.userId = findUserID[0] || uuidv4();
        users[socket.userId] = users[socket.userId] || {
          name: username,
          socketID: socket.id,
          servers: [],
          recentMessages: {}
        };
        users[socket.userId].servers.push(newRoomName);
        users[socket.userId].permits = users[socket.userId].permits || {};
      } 

      //This basically does the same as finding socket.id. 
      client01 = users[findUserIdByName(username)];
      if(typeof client01 === "undefined") {
        createBaseUserTemplate(username)
      
      }
    
      if(typeof client02 === "undefined") {
        createBaseUserTemplate(usernameToAdd)
        client02 = users[findUserIdByName(usernameToAdd)];
      }
      console.log(users)
      console.log(client01)
      console.log(client02)
      */
      // Generate a new UUID for the room
      const roomId = uuidv4();

      //If user doesnt have socket id, add it. 
      socket.userId = socket.userId || uuidv4(); // Set socket.userId if not already set
      // Create a new room object with the generated UUID
      rooms[roomId] = { name: newRoomName, messages: [], users: {} };

      //add room for both users
      console.log(client01)
      console.log(findUserIdByName(username))
      console.log(findUserIdByName(username))
      console.log("client01")
      if(!client01.servers && !client01.permits) {
        client01.permits = {}
        client01.servers = []
      }
      client01.servers.push(roomId);
      client01.permits = client01.permits || {};
      client01.permits[roomId] = {
        hasPermitToPost: true,
        hasPermitToKick: false,
      };

      client02.servers.push(roomId);
      client02.permits = client02.permits || {};
      client02.permits[roomId] = {
        hasPermitToPost: true,
        hasPermitToKick: false,
      }; 
    // console.log(users)
    console.log(rooms)
    console.log("rooms")
    updateServersToUsers(roomId)
    
  } catch (e) {
    console.log(e)
  }
  });





  socket.on("addPermitToUser", (admin, room, username) => {
    let isAdmin = false;
    for (let userid in users) {
      if (users[userid].name === admin) {
         isAdmin = true;
      }
    }
    for(let userid in users) {
      if (users[userid].name === username && isAdmin) {
        users[userid].permits[room].hasPermitToKick = true;
        console.log( users[userid].permits[room])
        isAdmin = false;
        const admin = Object.values(users).map(
          (user) => user.permits[room]?.hasPermitToKick || false
        );
        const user = Object.values(rooms[room].users);
  
        const combine = user.reduce((result, user, index) => {
          result[user] = admin[index];
          return result;
        }, {}); // Initialize as an empty object
  
        io.to(room).emit("admins", combine);
      }
    }
  });





  socket.on("deletePermitFromUser", (admin, room, username) => {
    let isAdmin = false;
    for (let userid in users) {
      if (users[userid].name === admin) {
         isAdmin = true;
      }
    }
    for(let userid in users) {
      if (users[userid].name === username && isAdmin) {
        users[userid].permits[room].hasPermitToKick = false;
        isAdmin = false;
        const admin = Object.values(users).map(
          (user) => user.permits[room]?.hasPermitToKick || false
        );
        const user = Object.values(rooms[room].users);
  
        const combine = user.reduce((result, user, index) => {
          result[user] = admin[index];
          return result;
        }, {}); // Initialize as an empty object
  
        io.to(room).emit("admins", combine);
      }
    }
  });




  socket.on("joinRoom", (roomId, username, firebaseToken) => {
    console.log("join room happened");
    socket.join(roomId);
    console.log(users)
    console.log(rooms[1])

    // Store the user in the room with the socket ID and username
    rooms[roomId].users[socket.id] = username;
    io.to(roomId).emit("users", Object.values(rooms[roomId].users), {
      admin: "hasId",
    });

    Object.values(users).filter((user) => {
      if (user.name === username && user.socketID === false) {
        user.socketID = socket.id;
      }
    });

    const findUserID = Object.keys(users).filter((key) => {
      const user = users[key];
      console.log("socket set in join room");
      
      return user.name === username && user.socketID === socket.id;
    });

    let bUserAlreadyExist = true;

    //Checks if username already exists, returns boolean, eg if user is found, bUserAlreadyExist is set to true, visa versa.
    if (typeof findUserID[0] === "undefined") {
      bUserAlreadyExist = Object.values(users).some(
        (user) => user.name === username
      );
    }

    if (!bUserAlreadyExist) {
      socket.userId = findUserID[0] || uuidv4();
      console.log("firebaseToken: " + firebaseToken)
      users[socket.userId] = users[socket.userId] || {
        name: username,
        socketID: socket.id,
        servers: [],
        recentMessages: {},
        token: firebaseToken
      };
      users[socket.userId].permits = users[socket.userId].permits || {};
      if(firebaseToken) {
        users[socket.userId].token = firebaseToken
      }
    }

    if (roomId !== "room1") {
      const admin = Object.values(users).map(
        (user) => user.permits[roomId]?.hasPermitToKick ?? false
      );

      let isAdmin = false;
      Object.values(users).forEach((user) => {
        if (user.name === username) {
          isAdmin = user.permits[roomId]?.hasPermitToKick ?? false;
        }
      });

      const usersInRoom = Object.values(users).filter((user) =>
        user.servers.includes(roomId)
      );
      const adminlist = {};

      const admins = Object.values(usersInRoom).map((user) => {
        if (user.permits.hasOwnProperty(roomId)) {
          return (adminlist[user.name] = user.permits[roomId].hasPermitToKick);
        } else {
          return (adminlist[user.name] = false);
        }
      });

      const usersInRoom1 = Object.values(rooms[roomId].users);
      Object.values(users).filter((user) => usersInRoom1.includes(user.name));
      const combine = usersInRoom1.reduce((result, user, index) => {
        result[user] = isAdmin;
        return result;
      }, {});

      //empty or initialize recentmessages on join  mayby might cause issue later on with a lot of things
      Object.values(users).map((user) => {
        if (user.name === username) {
          if (typeof user.recentMessages == "undefined") {
            user.recentMessages = {};
          }
          user.recentMessages[roomId] = [];
        }
      });

      /*     if(!users[socket.id].recentMessages || !users[socket.id].recentMessages[roomId]) {
        if(users[socket.id].recentMessages && users[socket.id].recentMessages[roomId]) {
          users[socket.id].recentMessages[roomId] = [];
        } else {
          users[socket.id].recentMessages = { roomId: [] } 
        }
      }
      */
      const usersInThisRoomThatAreOnline = Object.values(users)
        .filter((user) => user.servers.includes(roomId))
        .map((user) => user.name);
      //io.to(rooId).emit("userThatAreOnline", adminlist)
      //tässä on onlinessa olevat, nyt kun disconnect ja socket laitetaa false miten se emitoidaan joka huoneeseen jossa tämä on
      //Käytä ehkä timeria jos disconnect kestää yli minuutin sillon on offline muulloion on kyseessä vain muu socketin vaihto tms?

      io.to(roomId).emit("admins", adminlist);
    }

    // Send existing messages to the newly connected user
    socket.emit("messages", rooms[roomId].messages);

    // Send the list of users to the newly connected user
    io.to(roomId).emit("users", Object.values(rooms[roomId].users));
  });





  socket.on("createRoom", (newRoomName, username) => {
    try {
      console.log("creating new room...")
  
      const roomId = uuidv4();
  
      // Create a new room object with the generated UUID
      rooms[roomId] = { name: newRoomName, messages: [], users: {} };
  
      users[socket.userId].servers.push(roomId);
     //   users[socket.userId].permits = users[socket.userId].permits || {};
      users[socket.userId].permits[roomId] = {
        hasPermitToPost: true,
        hasPermitToKick: true,
      };
      // Get all servers from the user object
      let userServers = users[socket.userId].servers;
      let availableServers = Object.keys(rooms).filter((roomId) =>
        userServers.includes(roomId)
      );
      //console.log("User's servers:", userServers);
      //console.log("Available rooms:", Object.keys(rooms));
      // console.log("Available servers:", availableServers);
      // console.log( users[socket.userId])
      // Broadcast the updated list of rooms to all clients
      //socket.emit("availableRooms", availableServers);
      updateServersToUsers(roomId);
    } catch(e) {
      console.log("error while creating new room: " + username + "tried to creat room causing error: " + e)
    }
  });

  function serversThatAreAvailable() {
    //tää runnaan kokoajan!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    let userServers = users[socket.userId].servers;
    let availableServers = Object.keys(rooms).filter((roomId) =>
      userServers.includes(roomId)
    ); //tästä saa id
    const filteredRoomNames = Object.keys(rooms)
      .filter((roomId) => userServers.includes(roomId))
      .map((roomId) => rooms[roomId].name);
    socket.emit("availableRooms", availableServers, filteredRoomNames);
  }

  // Send existing messages to the newly connected user
  const { room } = socket.handshake.query;

  // Send existing messages to the newly connected user
  if (rooms[room]) {
    socket.emit("messages", rooms[room].messages);
  } else {
    socket.emit("messages", []);
  }

  // Send the list of users to the newly connected user
  if (rooms[room]) {
    io.to(room).emit("users", Object.values(rooms[room].users));
  } else {
    io.to(room).emit("users", []);
  }

  socket.join(room);

  const fs = require('fs');
  const path = require('path');

  function saveBase64Image(base64String, filePath) {
    const base64Data = base64String.replace(/^data:image\/png;base64,/, "");

    fs.writeFile(filePath, base64Data, { encoding: 'base64' }, function(err) {
        if (err) {
            console.log('File could not be saved:', err);
        } else {
            console.log('File saved successfully');
        }
    });
}

  socket.on("sendMessage", async (message) => {
    console.log(message)
    console.log("message")
    
    const url = message.text.img ? await getMediaFromBucket(message.text.img) : null; 
    console.log(url)
    const { room } = message;
    if(message.text.img) {
/*       const filePath = path.join(__dirname, `output${uuidv4()}.png`);
      saveBase64Image(message.text.img, filePath); */
    }
    if(message.text.video) {
      console.log(message.text.video)
    }

    try {
      console.log(  users[socket.userId])
      if (
        room &&
        rooms[room] &&
        users[socket.userId].permits[room].hasPermitToPost
      ) {
        const userInRoom = rooms[room].users[socket.id]; // Get user nickname

        rooms[room].messages.push({
          id: socket.id,
          text: message.text,
          img: url,
          timestamp: message.timestamp,
          userName: userInRoom,
        });

        const socketsToEmit = []; 
        const tokensToSendNotification = [];

        // Iterate over users to find those in the room
        for (const userId in users) {
          if (Object.hasOwnProperty.call(users, userId)) {
            const user = users[userId];
            if (Array.isArray(user.servers) && user.servers.includes(room)) {
              console.log(`User ${userId} is in server ${room}`);
              if (typeof user.recentMessages == "undefined") {
                user.recentMessages = {};
              }
              if (!user.recentMessages[room]) {
                user.recentMessages[room] = [];
              }
              user.recentMessages[room].push([
                userInRoom,
                message.text.timestamp,
                message.text.message,
                message.img ? null : url,
              ]);
              if (user.servers.includes(room)) {
                console.log(user.socketID);
                socketsToEmit.push(user.socketID); 
                if(user.socketID) {
                  tokensToSendNotification.push(user.token)
                }
              }
            }
          }
        }


        /* notification lähettäminen, set timeout on vaan itteäni varten että kerkee sulkemaan sovelluksen ja näkemään viestin */
        const firebasemessage = {
          notification: {
              title:  `${userInRoom} ${message.text.timestamp}`,
              body: message.img ? 'Media' : message.text.message
          },
        };

        setTimeout(() => {
        tokensToSendNotification.forEach(token => {
          const firebasemessageWithToken = {...firebasemessage, token};
          admin.messaging().send(firebasemessageWithToken)
          .then((response) => {
            console.log("Successfully sent notification:", response);
          })
          .catch((error) => {
            console.log("Error sending notification:", error);
          });
        });
        },5000)


        console.log("Socket IDs to emit:", socketsToEmit);
        socketsToEmit.forEach((socketID) => {
          const user = Object.values(users).find(
            (user) => user.socketID === socketID
          );
          if (user) {
            console.log(socketID);
            // You can now emit to this socketID
            io.to(socketID).emit(
              "RecentNotificationMessages",
              user.recentMessages
            );
          } else {
            console.log(`User with socket ID ${socketID} not found.`);
          }
        });
        io.to(room).emit("messages", rooms[room].messages); // Emit messages to the room
      }
    } catch(e) {
      console.log("error happened during send message: " + e)
    }
  });



  //users tyhjentyy tietenki aina server restartin jälkeen............
  socket.on("setName", (previousName, name) => {
    try {
      if (!socket.userId) { //Alunperin !previousName
        socket.userId = uuidv4();
        users[socket.userId] = {
          name: name,
          servers: [],
        };
      } else if (users[socket.userId].name === '') {
        users[socket.userId].name = name;
      }else if (previousName && name) {
        const userIdsWithPreviousName = Object.keys(users).find(
          (id) => users[id].name === previousName
        );
        if (userIdsWithPreviousName) {
          const user = users[userIdsWithPreviousName];
          user.name = name;
          userServers = user.servers;
          userServers.forEach((room) => {
            if (rooms[room]) {
              rooms[room].messages.forEach((message) => {
                if (message) {
                  message.userName = name;
                }
              });
              io.to(room).emit("users", Object.values(rooms[room].users));
              io.to(room).emit("messages", rooms[room].messages);
            }
          });
        }
      }
      //tää päivittää sillain että hommaa vaan ne huoneet jossa käyttäjä on
      // Update the user name in all rooms
      /*       Object.keys(rooms).forEach((room) => {
          rooms[room].messages.forEach((message) => {
            if (message.id === socket.id) {
              message.userName = name;
            }
          });
          io.to(room).emit('users', Object.values(rooms[room].users));
          io.to(room).emit('messages', rooms[room].messages);
        }); */
    } catch(e) {
      console.log("error happened while setting user name, error: " + e)
    }
  });


  socket.on("recentMessages", (user) => {
    
    function findUserIdByName(user) {
      for (const [userId, userInfo] of Object.entries(users)) {
        if (userInfo.name === user) {
          return userId;
        }
      }
      return null; 
    }

    const getuser =  users[findUserIdByName(user)]
    const getServers = getuser?.servers ?? [];
    let recentMessages = [];
    
    for (let x = 0; x < getServers.length; x++) {
        const currentMessage = rooms[getServers[x]].messages[rooms[getServers[x]].messages.length - 1];
       
        if(currentMessage) {
          if (!currentMessage.img) {
            const messageObject = {
                room: getServers[x],
                timestamp: currentMessage.text.timestamp,
                message: currentMessage.text.message,
                username: currentMessage.text.userName,
            };
            recentMessages.push(messageObject);
        } else {
            const messageObject = {
                room: rooms[getServers[x]],
                timestamp: currentMessage.timestamp,
                message: currentMessage.img,
                username: currentMessage.text.userName
            };
            recentMessages.push(messageObject);
         }
        }
    }

    //return it back to client
  //  console.log(recentMessages)
   // console.log(`recent messages: ^^`)
    socket.emit("recentMessagesResponse", recentMessages);
  })
  
    //täällä tapahtus invite add friend jne jne jne yhden serverin lisääminen, tän pitäs ehkä olla suoraan vaan 
  function updateServersToUsers(room) {
    /*     
      {
        '6e3d1c8d-b42c-4bac-bb00-f731c20c79fc': {
          name: '123',
          socketID: '1XQCcd5G3PSXBLa3AAAC',
          servers: [ 'd2f851ed-0d08-407a-a58e-da9bddc159bc' ],
          permits: { 'd2f851ed-0d08-407a-a58e-da9bddc159bc': [Object] }
        },
        {
        '5e3d1c8d-b42c-4bac-bb00-f731c20c79fc': {
          name: '223',
          socketID: '1XQCcd5G3PSXBLa3AAAC',
          servers: [  ],
          permits: { }
        },
        {
        '3e3d1c8d-b42c-4bac-bb00-f731c20c79fc': {
          name: '323',
          socketID: '1XQCcd5G3PSXBLa3AAAC',
          servers: [  ],
          permits: {  }
        }
      } 
  */

      let usersToEmit = [];
      if (Object.values(users).some((user) => user.servers.includes(room))) {
        usersToEmit = [];
        Object.values(users).forEach((user) => {
          if (user.servers.includes(room) && user.socketID !== false) {
            let userServers = user.servers;
            usersToEmit.push(user.socketID);
            let availableServers = Object.keys(rooms).filter((roomId) =>
              userServers.includes(roomId) && roomId  !== "room1"
            ); //tästä saa id
            const filteredRoomNames = Object.keys(rooms)
              .filter((roomId) => userServers.includes(roomId) && rooms[roomId].name !== null && rooms[roomId].name !== undefined)
              .map((roomId) => rooms[roomId].name);

            
              console.log(usersToEmit)
              console.log(user)
            //  console.log(availableServers)
            //  console.log(filteredRoomNames)
              console.log("user to invite")

           // io.to(socket.id).emit("availableRooms", availableServers, filteredRoomNames);
            usersToEmit.forEach((socket) => {
              io.to(socket).emit("availableRooms", availableServers, filteredRoomNames);
            });
          }
        });
       


    }

/*     usersToEmit.forEach((socket) => {
      
    let userServers = user.servers;
    let availableServers = Object.keys(rooms).filter((roomId) =>
      userServers.includes(roomId)
    ); //tästä saa id
    const filteredRoomNames = Object.keys(rooms)
      .filter((roomId) => userServers.includes(roomId))
      .map((roomId) => rooms[roomId].name);
      //console.log(socket)

   
      io.sockets.connected[socket].emit("availableRooms", availableServers, filteredRoomNames);
    }); */
/*     usersToEmit.forEach((socket) => {
      io.sockets.connected[socket].emit("getInvitedRoom", room, username);
    }); */
  }
 
  socket.on("test", () => {
    socket.emit("tester", "test message");
  });
  

  app.get("/screenshot", (req, res) => {
    const screenshotPath = path.join(__dirname, "public", "screenshot.png");
    const screenshotDirectory = path.dirname(screenshotPath);

    // Ensure the directory exists
    fs.mkdirSync(screenshotDirectory, { recursive: true });

    // Check write permissions
    fs.access(screenshotDirectory, fs.constants.W_OK, (err) => {
      if (err) {
        console.error("Write access error:", err);
        return res
          .status(500)
          .send("Error: Server does not have write permissions");
      }

      // Proceed with screenshot capture
      desktopScreenshot(screenshotPath, (error, complete) => {
        if (error) {
          console.error(error);
          return res.status(500).send("Error capturing screenshot");
        }

        if (complete) {
          console.log("Screenshot captured successfully");

          // Read the captured screenshot file
          fs.readFile(screenshotPath, (err, data) => {
            if (err) {
              console.error(err);
              return res.status(500).send("Error reading screenshot file");
            }

            const imageData = data.toString("base64");
            const responseObj = { imageData, path: "/screenshot.png" };

            // Send the image data and path as JSON to all connected clients
            socket.emit("screenshot", responseObj); //io emit jos haluaa päivittää kaikille...?

            // Set the response content type to JSON
            res.setHeader("Content-Type", "application/json");

            // Send a JSON response to the client
            return res.status(200).json(responseObj);
          });
        }
      });
    });
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
    try{
      Object.values(users).forEach((user) => {
        if(user.socketID == socket.id) {
          user.socketID = false
        } 
      })
     delete rooms[room].users[socket.id];
      io.to(room).emit("users", Object.values(rooms[room].users));
    } catch(e) {
      console.log("while exiting error happened: " + e)
    }
  });
});

module.export = app; 

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
 

/* const hostname = "192.168.100.38";
const port = "3001";
app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
}); */