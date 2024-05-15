const express = require('express');
const https = require('https');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = https.createServer({
    key: fs.readFileSync(path.join(__dirname, 'private.key')),
    cert: fs.readFileSync(path.join(__dirname, 'certificate.crt')) // Corregido el argumento fs.readFileSync
}, app);

const io = socketIO(server);

let rooms = [];

function createRooms() {
    const numRooms = Math.ceil(io.engine.clientsCount / 25);
    rooms = [];

    for (let i = 0; i < numRooms; i++) {
        rooms.push({ id: i, clients: [] });
    }

    let roomIndex = 0;
    io.sockets.sockets.forEach(socket => {
        rooms[roomIndex].clients.push(socket.id);
        if (rooms[roomIndex].clients.length === 25) {
            roomIndex++;
        }
    });
}

function findAvailableRoom() {
    const availableRoom = rooms.find(room => room.clients.length < 25);
    return availableRoom ? availableRoom.id : null;
}

io.on('connection', (socket) => {
    console.log('Un cliente se ha conectado.');

    createRooms();

    const roomId = findAvailableRoom();
    if (roomId !== null) {
        socket.join(`room-${roomId}`);
    } else {
        socket.emit('roomFull');
        return;
    }

    socket.on('disconnect', () => {
        console.log('Un cliente se ha desconectado.');
        createRooms();
    });

    socket.on('message', (data) => {
        console.log('Mensaje recibido:', data.message);
        const message = { name: data.name, message: data.message };

        // Transmitir el mensaje a todos los clientes en la misma sala
        socket.to(`room-${roomId}`).emit('message', message);
    });

    socket.on('newRoom', () => {
        io.to(`room-${roomId}`).emit('cleanChat');
    });
});

const indexPath = path.join(__dirname, 'index.html');

app.get('/', (req, res) => {
    res.sendFile(indexPath);
});

const os = require('os');
const networkInterfaces = os.networkInterfaces();
let ipAddress;
Object.keys(networkInterfaces).forEach(interfaceName => {
    const networkInterface = networkInterfaces[interfaceName];
    networkInterface.forEach(network => {
        if (!network.internal && network.family === 'IPv4') {
            ipAddress = network.address;
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Servidor escuchando en https://${ipAddress}:${PORT}`);
});
