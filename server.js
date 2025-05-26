require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.use(express.json());

const io = new Server(server, {
    cors: corsOptions,
});

// Simpele in-memory chat rooms
const chatRooms = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Basis authenticatie via token in handshake.auth.token
    let username = 'Guest';
    socket.userRole = 'user';
    if (socket.handshake.auth && socket.handshake.auth.token) {
        try {
            const token = socket.handshake.auth.token;
            // Simpele base64 decode van 'JWT'
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            username = payload.username || 'Authenticated User';
            socket.userRole = payload.role || 'user';
            console.log(`User ${username} (${socket.userRole}) connected.`);
        } catch (e) {
            console.warn("Invalid token for Socket.IO connection:", e.message);
            username = 'Invalid Token User';
        }
    } else {
        console.log("Guest user connected (no token).");
    }
    socket.username = username;

    socket.on('joinRoom', (roomName) => {
        socket.join(roomName);
        socket.currentRoom = roomName;
        console.log(`${socket.username} joined room: ${roomName}`);

        if (chatRooms[roomName]) {
            socket.emit('chatHistory', chatRooms[roomName]);
        } else {
            chatRooms[roomName] = [];
        }

        io.to(roomName).emit('message', {
            username: 'System',
            text: `${socket.username} is de chat binnengekomen.`
        });
    });

    socket.on('sendMessage', (data) => {
        const { room, text } = data;
        if (!room || !text) return;

        const message = {
            username: socket.username,
            text: text,
            timestamp: new Date().toISOString(),
            role: socket.userRole
        };

        if (!chatRooms[room]) chatRooms[room] = [];
        chatRooms[room].push(message);

        if (chatRooms[room].length > 100) chatRooms[room].shift();

        io.to(room).emit('message', message);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        if (socket.currentRoom) {
            io.to(socket.currentRoom).emit('message', {
                username: 'System',
                text: `${socket.username} heeft de chat verlaten.`
            });
        }
    });
});

app.get('/', (req, res) => {
    res.status(200).send('Vidigu Backend is Running!');
});

app.post('/api/auth/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Vul alle velden in.' });
    }
    // TODO: Hash wachtwoord, opslaan in DB
    res.status(201).json({ message: 'Gebruiker succesvol geregistreerd (simulatie).', user: { username, email } });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Vul e-mail en wachtwoord in.' });
    }
    // Dummy users
    if (email === 'test@example.com' && password === 'password123') {
        const dummyUser = { id: '123', username: 'TestUser', email: email, role: 'user' };
        const dummyTokenPayload = {
            userId: dummyUser.id,
            username: dummyUser.username,
            email: dummyUser.email,
            role: dummyUser.role,
            exp: Math.floor(Date.now() / 1000) + (60 * 60)
        };
        const dummyToken = Buffer.from(JSON.stringify(dummyTokenPayload)).toString('base64');
        return res.status(200).json({ message: 'Login succesvol (simulatie).', token: `fakeHeader.${dummyToken}.fakeSignature`, user: dummyUser });
    }
    if (email === 'streamer@example.com' && password === 'password123') {
        const dummyUser = { id: '456', username: 'MyStreamer', email: email, role: 'streamer' };
        const dummyTokenPayload = {
            userId: dummyUser.id,
            username: dummyUser.username,
            email: dummyUser.email,
            role: dummyUser.role,
            exp: Math.floor(Date.now() / 1000) + (60 * 60)
        };
        const dummyToken = Buffer.from(JSON.stringify(dummyTokenPayload)).toString('base64');
        return res.status(200).json({ message: 'Login succesvol (simulatie).', token: `fakeHeader.${dummyToken}.fakeSignature`, user: dummyUser });
    }
    res.status(401).json({ message: 'Ongeldige inloggegevens.' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Backend draait op poort ${PORT}`);
    console.log(`CORS ingesteld voor ${corsOptions.origin}`);
});
