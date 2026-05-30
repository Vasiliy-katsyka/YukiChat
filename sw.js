// YukiChat Modern Service Worker
importScripts('https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js');

const CACHE_NAME = 'yukichat-v1';
const API_URL = 'https://vps.yukichat.lol:8443'; // ABSOLUTE VPS API PORT [2]
const APP_URL = 'https://yukichat.lol';          // MAIN FRONTEND DOMAIN [2]

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
            if (token) {
                // Fetch from absolute API path to prevent relative 404 failures [2]
                return fetch(`${API_URL}/api/sync`, {
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
                        // Gather all chats that have unread items [2]
                        const unreadChats = syncData.chats.filter(c => c.unread > 0 && c.id !== 'ai');
                        
                        if (unreadChats.length > 0) {
                            const promises = unreadChats.map(unreadChat => {
                                const isDM = unreadChat.type === 'dm';
                                const senderName = isDM ? unreadChat.dm_username : unreadChat.name;
                                const bodyText = unreadChat.last_msg || "New message received";
                                const avatar = isDM ? (unreadChat.dm_avatar || `${APP_URL}/icon-192-lgbt.png`) : (unreadChat.avatar || `${APP_URL}/icon-192-lgbt.png`);
                                
                                return showIndividualNotification(unreadChat.id, senderName, bodyText, avatar, unreadChat.last_msg_id);
                            });
                            return Promise.all(promises);
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

// Displays each message separately as requested [2]
function showIndividualNotification(chatId, sender, text, icon, msgId) {
    // Unique tags prevent notifications from replacing each other on screen [2]
    const tag = `msg_${msgId || Date.now()}`;
    
    // We omit the monochrome 'badge' property so Android defaults to your beautiful colored icon [2]
    const options = {
        body: text,
        icon: icon,
        badge: `${APP_URL}/badge.png`,
        tag: tag,
        data: { 
            url: `${APP_URL}/?chat=${chatId}`
        },
        vibrate: [200, 100, 200]
    };

    return self.registration.showNotification(sender, options);
}

function showDefaultNotification() {
    return self.registration.showNotification("YukiChat", {
        body: "You have new messages waiting!",
        icon: `${APP_URL}/icon-192-lgbt.png`,
        tag: 'default-alert',
        data: { url: `${APP_URL}/` },
        vibrate: [200, 100, 200]
    });
}

// HANDLES CLICKING THE NOTIFICATION
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    const urlToOpen = event.notification.data ? event.notification.data.url : `${APP_URL}/`;

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
