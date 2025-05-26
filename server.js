// server.js
require('dotenv').config(); // Laad omgevingsvariabelen uit .env bestand

const express = require('express');
const cors = require('cors');
const http = require('http'); // Nodig voor Socket.IO
const { Server } = require('socket.io'); // Socket.IO server

const app = express();
const server = http.createServer(app); // Maak een HTTP server voor Express en Socket.IO

// Configureer CORS voor Express (voor je frontend)
// Zorg ervoor dat je de exacte URL van je GitHub Pages site hier invult
// DEZE WAARDE KOMT VAN JE .env of Render ENV VARS
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:8080', // Bijv. 'https://lucas6412f1.github.io/Vidigu/'
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Belangrijk voor cookies/tokens als je die later gebruikt
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Middleware voor het parsen van JSON body's
app.use(express.json());

// --- Socket.IO Setup (voor de chatfunctionaliteit) ---
const io = new Server(server, {
    cors: corsOptions, // Gebruik dezelfde CORS opties als voor Express
    // Hier kun je later nog opties voor Socket.IO authenticatie toevoegen
});

// Map om actieve rooms en hun berichten op te slaan (simpele in-memory opslag)
// LET OP: Dit is tijdelijk! Voor productie heb je een database nodig om berichten vast te houden.
const chatRooms = {}; // { 'channel_name': [{ username: 'user', text: 'hello', timestamp: '...' }] }

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Basis authenticatie (voorbeeld - in een echt project check je JWT)
    // Bijv. socket.handshake.auth.token
    let username = 'Guest'; // Standaard gebruikersnaam
    if (socket.handshake.auth && socket.handshake.auth.token) {
        // Hier zou je JWT token moeten valideren en de gebruikersnaam/rol ophalen
        // Voor nu simuleren we dit even:
        try {
            const token = socket.handshake.auth.token;
            // Dit is een simpele base64 decode. Echte JWT validatie gebruikt een bibliotheek (jsonwebtoken).
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            username = payload.username || 'Authenticated User';
            socket.userRole = payload.role || 'user'; // Rol van de gebruiker (bijv. 'streamer', 'moderator', 'user')
            console.log(`User <span class="math-inline">\{username\} \(</span>{socket.userRole}) connected.`);
        } catch (e) {
            console.warn("Invalid token for Socket.IO connection:", e.message);
            username = 'Invalid Token User';
        }
    } else {
        console.log("Guest user connected (no token provided).");
    }
    socket.username = username;


    socket.on('joinRoom', (roomName) => {
        socket.join(roomName);
        socket.currentRoom = roomName;
        console.log(`${socket.username} joined room: ${roomName}`);

        // Stuur chatgeschiedenis naar de nieuwe gebruiker
        if (chatRooms[roomName]) {
            socket.emit('chatHistory', chatRooms[roomMame]);
        } else {
            chatRooms[roomName] = []; // Maak een nieuwe chatroom aan als deze nog niet bestaat
        }

        // Optioneel: stuur een welkomstbericht naar de kamer
        io.to(roomName).emit('message', {
            username: 'System',
            text: `${socket.username} is de chat binnengekomen.`
        });
    });

    socket.on('sendMessage', (data) => {
        const { room, text } = data;
        if (!room || !text) return; // Valideer input

        const message = {
            username: socket.username,
            text: text,
            timestamp: new Date().toISOString(),
            role: socket.userRole // Voeg rol toe aan het bericht
        };

        if (!chatRooms[room]) {
            chatRooms[room] = [];
        }
        chatRooms[room].push(message);

        // Zorg dat de chatgeschiedenis niet te groot wordt
        if (chatRooms[room].length > 100) { // Houd de laatste 100 berichten vast
            chatRooms[room].shift(); // Verwijder het oudste bericht
        }

        io.to(room).emit('message', message); // Stuur bericht naar alle in de room
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


// --- Express API Routes ---

// Voorbeeld van een root route
app.get('/', (req, res) => {
    res.status(200).send('Vidigu Backend is Running!');
});

// Auth Routes (later in een aparte auth.js)
// Simpele placeholder, echte logica komt hier later
app.post('/api/auth/register', (req, res) => {
    // Hier komt de logica voor gebruikersregistratie
    const { username, email, password } = req.body;
    console.log(`Registratiepoging: ${username}, ${email}, ${password ? 'Wachtwoord ontvangen' : 'Geen wachtwoord'}`);
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Vul alle velden in.' });
    }
    // TODO: Hash wachtwoord, opslaan in DB, etc.
    res.status(201).json({ message: 'Gebruiker succesvol geregistreerd (simulatie).', user: { username, email } });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    console.log(`Loginpoging: ${email}, ${password ? 'Wachtwoord ontvangen' : 'Geen wachtwoord'}`);
    if (!email || !password) {
        return res.status(400).json({ message: 'Vul e-mail en wachtwoord in.' });
    }
    const dummyUser = { id: '123', username: 'TestUser', email: email, role: 'user' };
    if (email === 'test@example.com' && password === 'password123') {
        const dummyTokenPayload = {
            userId: dummyUser.id,
            username: dummyUser.username,
            email: dummyUser.email,
            role: dummyUser.role,
            exp: Math.floor(Date.now() / 1000) + (60 * 60) // Token 1 uur geldig
        };
        const dummyToken = Buffer.from(JSON.stringify(dummyTokenPayload)).toString('base64'); // Zeer simpele 'token'
        res.status(200).json({ message: 'Login succesvol (simulatie).', token: `fakeHeader.${dummyToken}.fakeSignature`, user: dummyUser });
    } else if (email === 'streamer@example.com' && password === 'password123') {
        const dummyStreamerUser = { id: '456', username: 'MyStreamer', email: email, role: 'streamer' };
        const dummyTokenPayload = {
            userId: dummyStreamerUser.id,
            username: dummyStreamerUser.username,
            email: dummyStreamerUser.email,
            role: dummyStreamerUser.role,
            exp: Math.floor(Date.now() / 1000) + (60 * 60)
        };
        const dummyToken = Buffer.from(JSON.stringify(dummyTokenPayload)).toString('base64');
        res.status(200).json({ message: 'Login succesvol (simulatie).', token: `fakeHeader.${dummyToken}.fakeSignature`, user: dummyStreamerUser });
    }
    else {
        res.status(401).json({ message: 'Ongeldige inloggegevens.' });
    }
});


// Poort waarop de server luistert
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { // Gebruik server.listen voor Socket.IO
    console.log(`Backend draait op poort ${PORT}`);
    console.log(`CORS ingesteld voor ${corsOptions.origin}`);
});