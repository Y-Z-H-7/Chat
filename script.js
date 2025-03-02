let socket;
let currentUser;

document.getElementById('login-btn').addEventListener('click', () => {
    const username = document.getElementById('username').value;
    if (username) {
        currentUser = username;
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('chat-container').classList.remove('hidden');

        socket = new WebSocket('ws://localhost:8080');

        socket.onopen = () => {
            console.log('WebSocket connection established');
            socket.send(JSON.stringify({ type: 'login', username: currentUser }));
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
                const chatWindow = document.getElementById('chat-window');
                chatWindow.innerHTML += `<p><strong>${data.from}:</strong> ${data.message}</p>`;
                chatWindow.scrollTop = chatWindow.scrollHeight;
            } else if (data.type === 'friendList') {
                const friendsList = document.getElementById('friends-list');
                friendsList.innerHTML = data.friends.map(friend => `<p>${friend}</p>`).join('');
            } else if (data.type === 'history') {
                const chatWindow = document.getElementById('chat-window');
                chatWindow.innerHTML = ''; // 清空聊天窗口
                data.messages.forEach((message) => {
                    chatWindow.innerHTML += `<p><strong>${message.from}:</strong> ${message.message}</p>`;
                });
                chatWindow.scrollTop = chatWindow.scrollHeight;
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        socket.onclose = () => {
            console.log('WebSocket connection closed');
        };
    }
});

document.getElementById('send-btn').addEventListener('click', () => {
    const message = document.getElementById('message-input').value;
    const targetUser = document.getElementById('target-user').value; // 获取目标用户
    if (message && targetUser) {
        socket.send(JSON.stringify({ type: 'message', from: currentUser, to: targetUser, message: message }));
        document.getElementById('message-input').value = '';
    }
});

document.getElementById('add-friend-btn').addEventListener('click', () => {
    const friendUsername = document.getElementById('add-friend-input').value;
    if (friendUsername) {
        socket.send(JSON.stringify({ type: 'addFriend', username: currentUser, friend: friendUsername }));
        document.getElementById('add-friend-input').value = '';
    }
});

// 新增：加载历史聊天记录
document.getElementById('load-history-btn').addEventListener('click', () => {
    const targetUser = document.getElementById('target-user').value;
    if (targetUser) {
        socket.send(JSON.stringify({ type: 'loadHistory', from: currentUser, to: targetUser }));
    }
});