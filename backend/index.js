// import express from "express";
// import http from "http";
// import { Server } from "socket.io";

// const app = express();

// const server = http.createServer(app);

// const io = new Server(server,{
//     cors : {
//         origin : "*",
//     }
// })

// const rooms = new Map();

// io.on("connection",(socket)=>{
//     console.log("user connected", socket.id);

//     let currentRoom = null;
//     let currentUser = null;

//     socket.on("join", ({roomId, userName})=>{
//         if(currentRoom){
//             socket.leave(currentRoom);
//             rooms.get(currentRoom).delete(currentUser);
//             io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId)));

//         }

//         currentRoom = roomId;
//         currentUser = userName;

//         socket.join(roomId);

//         if(!rooms.has(roomId)){
//             rooms.set(roomId, new Set());
//         }

//         rooms.get(roomId).add(userName);

//         io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId)));

//         // console.log("user Joined", roomId);
//     });
//     socket.on("codeChange",({roomId,code})=>{
//         socket.to(roomId).emit("codeUpdate",code); 
//     });

//     socket.on("leaveRoom", () => {
//     if (currentRoom && rooms.has(currentRoom)) {
//         rooms.get(currentRoom).delete(currentUser);

//         io.to(currentRoom).emit(
//             "userJoined",
//             Array.from(rooms.get(currentRoom))
//         );

//         if (rooms.get(currentRoom).size === 0) {
//             rooms.delete(currentRoom);
//         }
//     }

//     socket.leave(currentRoom);
//     currentRoom = null;
//     currentUser = null;
// });


//     socket.on("typing",({roomId,userName})=>{
//         socket.to(roomId).emit("userTyping",userName);
//     });

//     socket.on("languageChange", ({roomId, language})=>{
//         io.to(roomId).emit("languageUpdate", language);
//     });


//     socket.on("disconnect", () => {
//     if (currentRoom && rooms.has(currentRoom)) {
//         rooms.get(currentRoom).delete(currentUser);

//         io.to(currentRoom).emit(
//             "userJoined",
//             Array.from(rooms.get(currentRoom))
//         );

//         if (rooms.get(currentRoom).size === 0) {
//             rooms.delete(currentRoom);
//         }
//     }

//     console.log("user disconnected", socket.id);
// });

// });


// const port = process.env.PORT || 3001;

// server.listen(port, ()=>{
//     console.log(`Server is listening on port ${port}`);
// })
import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import axios from "axios";

const app = express();
const server = http.createServer(app);

// const url = `https://codesync-492y.onrender.com/`;
// const interval = 30000;

// function reloadWebsite() {
//   axios
//     .get(url)
//     .then((response) => {
//       console.log("website reloded");
//     })
//     .catch((error) => {
//       console.error(`Error : ${error.message}`);
//     });
// }

// setInterval(reloadWebsite, interval);


const io = new Server(server, {
  cors: { origin: "*" },
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("user connected", socket.id);

  let currentRoom = null;
  let currentUser = null;

  // ================= JOIN =================
  socket.on("join", ({ roomId, userName }) => {

    // 🔹 previous room cleanup (SAFE)
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(currentUser);

      io.to(currentRoom).emit(
        "userJoined",
        Array.from(rooms.get(currentRoom))
      );

      // delete empty room
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      }

      socket.leave(currentRoom);
    }

    // 🔹 set new room
    currentRoom = roomId;
    currentUser = userName;

    socket.join(roomId);

    // 🔹 create room if not exists
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    // 🔹 add user
    rooms.get(roomId).add(userName);

    // 🔹 send correct users list
    io.to(roomId).emit(
      "userJoined",
      Array.from(rooms.get(roomId))
    );
  });

  // ================= CODE CHANGE =================
  socket.on("codeChange", ({ roomId, code }) => {
    socket.to(roomId).emit("codeUpdate", code);
  });

  // ================= TYPING =================
  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  // ================= LANGUAGE CHANGE =================
  socket.on("languageChange", ({ roomId, language }) => {
    io.to(roomId).emit("languageUpdate", language);
  });

  // socket.on("compileCode",async({code,roomId,language,version})=>{
  //     if(rooms.has(roomId)){
  //       const room = rooms.get(roomId);
  //       const response = await axios.post("https://emkc.org/api/v2/piston/execute",{
  //           language,
  //           version,
  //           files:[
  //               {
  //                   content:code
  //               }
  //           ]
  //       });

  //       room.output = response.data.run.output;
  //       io.to(roomId).emit("codeResponse",response.data);
  //     }
  //   });



  socket.on("compileCode", async ({ code, roomId, language }) => {
  try {

    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);

    // Judge0 language ids
    const languageMap = {
      javascript: 63,
      python: 71,
      java: 62,
      cpp: 54,
    };

    const response = await axios.post(
      "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
      {
        language_id: languageMap[language],
        source_code: code,
      }
    );

    let output = "";

    // runtime error
    if (response.data.stderr) {
      output = response.data.stderr;
    }

    // compilation error
    else if (response.data.compile_output) {
      output = response.data.compile_output;
    }

    // success output
    else {
      output = response.data.stdout;
    }

    room.output = output;

    io.to(roomId).emit("codeResponse", {
      output,
      status: response.data.status.description,
      memory: response.data.memory,
      time: response.data.time,
    });

  } catch (error) {

    console.log(error.response?.data || error.message);

    io.to(roomId).emit("codeResponse", {
      output: "Code execution failed",
      status: "Error",
    });
  }
});


  // ================= LEAVE ROOM =================
  socket.on("leaveRoom", () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(currentUser);

      io.to(currentRoom).emit(
        "userJoined",
        Array.from(rooms.get(currentRoom))
      );

      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      }
    }

    socket.leave(currentRoom);
    currentRoom = null;
    currentUser = null;
  });

  // ================= DISCONNECT =================
  socket.on("disconnect", () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(currentUser);

      io.to(currentRoom).emit(
        "userJoined",
        Array.from(rooms.get(currentRoom))
      );

      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      }
    }

    console.log("user disconnected", socket.id);
  });
});

const port = process.env.PORT || 3001;

const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, "/frontend/dist")));

app.get("/{*any}",(req,res)=>{
    res.sendFile(path.join(__dirname,"frontend","dist","index.html"));
});

server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
 