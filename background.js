let timer = null;

// 初始化存储的默认值
chrome.runtime.onInstalled.addListener(async () => {
    await createOffscreenDocument();
    
    chrome.storage.local.set({
        timeLeft: 25 * 60,
        isWork: true,
        timerState: 'paused',
        workDuration: 25,
        breakDuration: 5
    });
});

// 开始计时器
function startTimer() {
    if (timer) return;
    
    timer = setInterval(async () => {
        const data = await chrome.storage.local.get(['timeLeft', 'isWork']);
        let timeLeft = data.timeLeft - 1;
        
        if (timeLeft < 0) {
            // 时间到，播放提示音
            await createOffscreenDocument();
            chrome.runtime.sendMessage({ type: 'PLAY_SOUND' });
            
            // 切换状态
            const switchData = await chrome.storage.local.get(['workDuration', 'breakDuration', 'isWork']);
            const newIsWork = !switchData.isWork;
            timeLeft = newIsWork ? switchData.workDuration * 60 : switchData.breakDuration * 60;
            
            await chrome.storage.local.set({
                timeLeft: timeLeft,
                isWork: newIsWork
            });

            // 通知所有标签页
            const tabs = await chrome.tabs.query({url: '*://*.youtube.com/*'});
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { type: 'TIMER_COMPLETE' });
            });
        } else {
            // 更新时间
            await chrome.storage.local.set({ timeLeft: timeLeft });
        }
    }, 1000);
}

// 停止计时器
function stopTimer() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

// 添加新的函数来创建 offscreen document
async function createOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length > 0) {
        return;
    }

    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Playing notification sound for Pomodoro timer'
    });
}

// 处理来自 popup 或 content script 的消息
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'START_TIMER') {
        startTimer();
    } else if (message.type === 'PAUSE_TIMER') {
        stopTimer();
    } else if (message.type === 'PLAY_SOUND') {
        // 确保 offscreen document 存在
        await createOffscreenDocument();
        // 转发消息到 offscreen document
        chrome.runtime.sendMessage({ type: 'PLAY_SOUND' });
    }
}); 