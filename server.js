const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(__dirname));

let waitingPlayer = null;

io.on('connection', (socket) => {
    socket.on('find_match', () => {
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            const roomName = `room_${waitingPlayer.id}_${socket.id}`;
            socket.join(roomName);
            waitingPlayer.join(roomName);

            // Gán vị trí: Một người bên trái (Red), một người bên phải (Blue)
            waitingPlayer.emit('match_found', { room: roomName, side: 'left' });
            socket.emit('match_found', { room: roomName, side: 'right' });
            
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit('waiting');
        }
    });

    socket.on('send_volume', (data) => {
        socket.to(data.room).emit('opponent_volume', { vol: data.vol });
    });

    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.id === socket.id) waitingPlayer = null;
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
