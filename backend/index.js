import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();

const server = http.createServer(app);

const io = new Server(server,{
    cors : {
        origin : "*",
    }
})

const rooms = new Map();

io.on("connection",(socket)=>{
    console.log("user connected", socket.id);

    let currentRoom = null;
    let currentUser = null;

    socket.on("join", ({roomId, userName})=>{
        if(currentRoom){
            socket.leave(currentRoom);
            rooms.get(currentRoom).delete(currentUser);
            io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
        }

        currentRoom = roomId;
        currentUser = userName;

        socket.join(roomId);

        if(!rooms.has(roomId)){
            rooms.set(roomId, new Set());
        }

        rooms.get(roomId).add(userName);

        io.to(roomId).emit("userJoined", Array.from(rooms.get(currentRoom)));
        // console.log("user Joined", roomId);
    });
    socket.on("codeChange",({roomId,code})=>{
        socket.to(roomId).emit("codeUpdate",code); 
    });

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


    socket.on("typing",({roomId,userName})=>{
        socket.to(roomId).emit("userTyping",userName);
    });


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

server.listen(port, ()=>{
    console.log(`Server is listening on port ${port}`);
})
 