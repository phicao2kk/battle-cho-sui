const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let waitingPlayer = null; // Hàng chờ ngẫu nhiên
let privateRooms = {};    // Lưu trữ phòng riêng: { "123456": socket }

io.on('connection', (socket) => {
    // 1. Tìm trận ngẫu nhiên
    socket.on('find_match', (data) => {
        socket.playerName = data.name || "Vô danh";
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            const roomName = `random_${waitingPlayer.id}_${socket.id}`;
            socket.join(roomName); waitingPlayer.join(roomName);
            waitingPlayer.emit('match_found', { room: roomName, side: 'left', opponentName: socket.playerName });
            socket.emit('match_found', { room: roomName, side: 'right', opponentName: waitingPlayer.playerName });
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit('waiting');
        }
    });

    // 2. Tạo phòng riêng
    socket.on('create_private', (data) => {
        socket.playerName = data.name || "Chủ phòng";
        const code = Math.floor(100000 + Math.random() * 900000).toString(); // Mã 6 số
        privateRooms[code] = socket;
        socket.join(code);
        socket.emit('room_created', { code: code });
    });

    // 3. Tham gia phòng riêng
    socket.on('join_private', (data) => {
        const code = data.code;
        const hostSocket = privateRooms[code];
        socket.playerName = data.name || "Khách";

        if (hostSocket && hostSocket.id !== socket.id) {
            socket.join(code);
            hostSocket.emit('match_found', { room: code, side: 'left', opponentName: socket.playerName });
            socket.emit('match_found', { room: code, side: 'right', opponentName: hostSocket.playerName });
            delete privateRooms[code]; // Xoá phòng sau khi ghép xong
        } else {
            socket.emit('error_msg', "Mã phòng không tồn tại hoặc đã đầy!");
        }
    });

    socket.on('send_volume', (data) => {
        socket.to(data.room).emit('opponent_volume', { vol: data.vol });
    });

    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.id === socket.id) waitingPlayer = null;
        // Xoá mã phòng nếu chủ phòng thoát
        for (let code in privateRooms) {
            if (privateRooms[code].id === socket.id) delete privateRooms[code];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server chạy tại: http://localhost:${PORT}`));
