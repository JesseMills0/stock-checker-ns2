const https = require('https');

const { printProgress } = require('./logger');
const { loadConfig } = require('./file-system');

function publishToNtfy(server, topic, message, token) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      `${server.replace(/\/$/, '')}/${encodeURIComponent(topic)}`,
      {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'text/plain; charset=utf-8',
        },
      },
      (response) => {
        response.resume();
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`ntfy returned HTTP ${response.statusCode}`));
          }
        });
      }
    );

    request.on('error', reject);
    request.write(message);
    request.end();
  });
}

async function notifyRecipients(recipients, recipientMessages) {
  const config = await loadConfig();
  const { server, topic, token } = config.ntfy;
  const updateProgress = await printProgress(
    `Sending ${recipientMessages.length} ntfy ${
      recipientMessages.length === 1 ? 'message' : 'messages'
    }... `,
    { end: false }
  );
  await updateProgress('[connecting to ntfy]');

  const messages = Array.from(new Set(recipientMessages.map(({ message }) => message)));
  for (let i = 0; i < messages.length; i++) {
    await updateProgress(`[${i + 1}/${messages.length}]`);
    await publishToNtfy(server, topic, messages[i], token);
  }

  await updateProgress('done!', { end: true });
}

exports.notifyRecipients = notifyRecipients;
