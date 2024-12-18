// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PLAY_SOUND') {
        const audio = document.getElementById('notificationSound');
        audio.play();
    }
}); 