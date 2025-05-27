require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs'); // Nieuw: voor wachtwoord hashing
const pool = require('./db'); // AANGEPAST: Importeer de database pool

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

    let username = 'Guest';
    socket.userRole = 'user';
    if (socket.handshake.auth && socket.handshake.auth.token) {
        try {
            const token = socket.handshake.auth.token;
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

// AANGEPAST: Registratie met database-integratie
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Vul alle velden in.' });
    }

    try {
        // Hash het wachtwoord
        const hashedPassword = await bcrypt.hash(password, 10); // 10 is de salt rounds

        // Sla de gebruiker op in de database
        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, role',
            [username, email, hashedPassword]
        );
        const newUser = result.rows[0];

        res.status(201).json({ message: 'Gebruiker succesvol geregistreerd.', user: newUser });
    } catch (error) {
        if (error.code === '23505') { // Unieke constraint overtreding (e.g., username/email bestaat al)
            return res.status(409).json({ message: 'Gebruikersnaam of e-mailadres bestaat al.' });
        }
        console.error('Fout bij registratie:', error);
        res.status(500).json({ message: 'Interne serverfout bij registratie.' });
    }
});

// AANGEPAST: Login met database-integratie
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Vul e-mail en wachtwoord in.' });
    }

    try {
        // Zoek de gebruiker op e-mail
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Ongeldige inloggegevens.' });
        }

        // Vergelijk het ingevoerde wachtwoord met de gehashte wachtwoord
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Ongeldige inloggegevens.' });
        }

        // AANGEPAST: Genereer hier een ECHTE JWT token met een library (bijv. jsonwebtoken)
        // Voor nu blijft het een simulatie, maar met echte user data
        const tokenPayload = {
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role
            // exp: Math.floor(Date.now() / 1000) + (60 * 60) // Vervaltijd (optioneel, zelf beheren)
        };
        // Dummy token generatie voor nu, later vervangen door JWT.sign
        const dummyToken = `fakeHeader.${Buffer.from(JSON.stringify(tokenPayload)).toString('base64')}.fakeSignature`;


        res.status(200).json({ message: 'Login succesvol.', token: dummyToken, user: { id: user.id, username: user.username, email: user.email, role: user.role } });

    } catch (error) {
        console.error('Fout bij login:', error);
        res.status(500).json({ message: 'Interne serverfout bij login.' });
    }
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Backend draait op poort ${PORT}`);
    console.log(`CORS ingesteld voor ${corsOptions.origin}`);
});