const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const { MongoClient } = require('mongodb');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync('index.html'));
});

const wss = new WebSocket.Server({ server });

let users = {};
let friends = {};

const uri = 'mongodb://localhost:27017'; // MongoDB 连接字符串
const client = new MongoClient(uri);

async function saveMessage(from, to, message) {
    try {
        await client.connect();
        const database = client.db('webchat');
        const collection = database.collection('messages');
        const result = await collection.insertOne({ from, to, message, timestamp: new Date() });
        console.log('Message saved to database:', result.insertedId);
    } finally {
        await client.close();
    }
}

async function loadHistory(from, to) {
    try {
        await client.connect();
        const database = client.db('webchat');
        const collection = database.collection('messages');
        const messages = await collection.find({
            $or: [
                { from: from, to: to },
                { from: to, to: from }
            ]
        }).sort({ timestamp: 1 }).toArray();
        return messages;
    } finally {
        await client.close();
    }
}

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        console.log('Received data:', data);

        if (data.type === 'login') {
            users[data.username] = ws;
            ws.username = data.username;
            broadcastFriendList();
        } else if (data.type === 'message') {
            if (users[data.to]) {
                if (friends[data.from] && friends[data.from].includes(data.to)) {
                    users[data.to].send(JSON.stringify({ type: 'message', from: data.from, message: data.message }));
                    users[data.from].send(JSON.stringify({ type: 'message', from: data.from, message: data.message }));
                    await saveMessage(data.from, data.to, data.message); // 保存消息
                } else {
                    users[data.from].send(JSON.stringify({ type: 'error', message: 'You can only send messages to friends.' }));
                }
            }
        } else if (data.type === 'addFriend') {
            if (data.username === data.friend) {
                users[data.username].send(JSON.stringify({ type: 'error', message: 'You cannot add yourself as a friend.' }));
            } else if (users[data.friend]) {
                if (friends[data.username] && friends[data.username].includes(data.friend)) {
                    users[data.username].send(JSON.stringify({ type: 'error', message: 'You are already friends with this user.' }));
                } else {
                    if (!friends[data.username]) {
                        friends[data.username] = [];
                    }
                    if (!friends[data.friend]) {
                        friends[data.friend] = [];
                    }
                    friends[data.username].push(data.friend);
                    friends[data.friend].push(data.username);

                    users[data.username].send(JSON.stringify({ type: 'friendList', friends: friends[data.username] }));
                    users[data.friend].send(JSON.stringify({ type: 'friendList', friends: friends[data.friend] }));
                }
            }
        } else if (data.type === 'loadHistory') {
            const messages = await loadHistory(data.from, data.to);
            users[data.from].send(JSON.stringify({ type: 'history', messages }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        delete users[ws.username];
        broadcastFriendList();
    });
});

function broadcastFriendList() {
    wss.clients.forEach((client) => {
        if (client.username && friends[client.username]) {
            client.send(JSON.stringify({ type: 'friendList', friends: friends[client.username] }));
        }
    });
}

server.listen(8080, () => {
    console.log('Server is listening on port 8080');
});