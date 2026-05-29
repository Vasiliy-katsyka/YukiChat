// YukiChat Modern Service Worker
importScripts('https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js');

const CACHE_NAME = 'yukichat-v1';

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
    event.respondWith(fetch(event.request).catch(() => {
        return new Response("Offline Mode");
    }));
});

// WAKES UP THE PHONE WHEN APP IS CLOSED
self.addEventListener('push', function(event) {
    event.waitUntil(
        localforage.getItem('y_t').then(function(token) {
            // If the user is logged in, perform a background fetch to get the most accurate unread data
            if (token) {
                return fetch('/api/sync', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                })
                .then(res => res.json())
                .then(syncData => {
                    if (syncData && syncData.chats) {
                        // Find the chat with unread messages to display
                        const unreadChat = syncData.chats.find(c => c.unread > 0 && c.id !== 'ai');
                        if (unreadChat) {
                            const isDM = unreadChat.type === 'dm';
                            const senderName = isDM ? unreadChat.dm_username : unreadChat.name;
                            const bodyText = unreadChat.last_msg || "New message received";
                            const avatar = isDM ? (unreadChat.dm_avatar || "/icon-192.png") : (unreadChat.avatar || "/icon-192.png");
                            
                            return showAggregatedNotification(unreadChat.id, senderName, bodyText, avatar, unreadChat.unread);
                        }
                    }
                    return showDefaultNotification();
                })
                .catch(() => showDefaultNotification());
            } else {
                return showDefaultNotification();
            }
        })
    );
});

// HELPER: Generates consolidated, Telegram-style notifications by conversation [2]
function showAggregatedNotification(chatId, sender, text, icon, serverUnreadCount) {
    const tag = `chat_${chatId}`;
    
    return self.registration.getNotifications({ tag: tag }).then(notifications => {
        const currentNotification = notifications[0];
        let title = sender;
        let body = text;
        let count = serverUnreadCount || 1;

        if (currentNotification) {
            // Read previous count and update dynamically
            const oldData = currentNotification.data || {};
            count = Math.max(count, (oldData.count || 1) + 1);
            title = `${sender} (${count} messages)`;
        }

        const options = {
            body: body,
            icon: icon,
            badge: '/icon-192.png',
            tag: tag,
            data: { 
                url: `/?chat=${chatId}`,
                count: count,
                chatId: chatId
            },
            vibrate: [200, 100, 200],
            renotify: true // Vibrates/buzzes the phone again even though we are updating an existing card! [2]
        };

        return self.registration.showNotification(title, options);
    });
}

function showDefaultNotification() {
    return self.registration.showNotification("YukiChat", {
        body: "You have new messages waiting!",
        icon: "/icon-192.png",
        badge: '/icon-192.png',
        tag: 'default-alert',
        data: { url: "/" },
        vibrate: [200, 100, 200]
    });
}

// HANDLES CLICKING THE NOTIFICATION
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    const urlToOpen = event.notification.data ? event.notification.data.url : "/";

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if (client.url.includes('/') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
