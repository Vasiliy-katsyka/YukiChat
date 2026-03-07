// sw.js
self.addEventListener('fetch', (event) => {
  // Keep it simple: let it do nothing but exist to satisfy the browser
});
// Listen for notification clicks
self.addEventListener('notificationclick', function(event) {
    // Close the notification
    event.notification.close();

    // Look for an open window/tab of your PWA
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // If the PWA is already open in the background, bring it to the front
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            // If it's closed, open a new window
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
