let timerInterval = null;

// 创建浮层元素
function createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'pomodoro-overlay work'; // 默认为工作状态
    overlay.id = 'pomodoroOverlay';
    overlay.innerHTML = '25:00';
    document.body.appendChild(overlay);
    
    // 添加点击事件处理
    overlay.addEventListener('click', async () => {
        const { timerState } = await chrome.storage.local.get(['timerState']);
        
        if (timerState === 'running') {
            // 如果正在运行，则暂停
            await chrome.storage.local.set({ timerState: 'paused' });
            stopLocalTimer();
            controlVideo('pause');
        } else {
            // 如果已暂停，则开始
            await chrome.storage.local.set({ timerState: 'running' });
            startLocalTimer();
            controlVideo('play');
        }
        
        // 通知 popup 更新按钮状态
        chrome.runtime.sendMessage({
            type: 'UPDATE_BUTTON_STATE',
            isRunning: timerState !== 'running'  // 切换后的状态
        });
    });
    
    return overlay;
}

// 控制视频播放/暂停
function controlVideo(action) {
    const video = document.querySelector('video');
    if (video) {
        if (action === 'play') {
            video.play();
        } else if (action === 'pause') {
            video.pause();
        }
    }
}

// 本地计时器控制
async function startLocalTimer() {
    // 通知 background 开始计时
    chrome.runtime.sendMessage({ type: 'START_TIMER' });
    
    // 控制视频播放
    controlVideo('play');
}

function stopLocalTimer() {
    // 通知 background 停止计时
    chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
    
    // 控制视频播放
    controlVideo('pause');
}

function updateOverlayDisplay(timeLeft, isWork) {
    const emoji = isWork ? '✍️' : '☕';
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    overlay.innerHTML = `${emoji} ${timeString}`;
    overlay.className = `pomodoro-overlay ${isWork ? 'work' : 'break'}`;
}

// 初始化浮层
const overlay = createOverlay();

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SYNC_TIMER') {
        // 同步时间和状��
        const { timeLeft, isWork } = message;
        updateOverlayDisplay(timeLeft, isWork);
    } else if (message.type === 'START_TIMER') {
        startLocalTimer();
        controlVideo('play');
    } else if (message.type === 'PAUSE_TIMER') {
        stopLocalTimer();
        controlVideo('pause');
    } else if (message.type === 'TIMER_COMPLETE') {
        // 播放提示音
        chrome.runtime.sendMessage({ type: 'PLAY_SOUND' });
    }
});

// 添加 storage 变化监听
chrome.storage.onChanged.addListener((changes) => {
    if (changes.timeLeft || changes.isWork) {
        const timeLeft = changes.timeLeft?.newValue;
        const isWork = changes.isWork?.newValue;
        
        if (typeof timeLeft !== 'undefined') {
            updateOverlayDisplay(
                timeLeft,
                typeof isWork !== 'undefined' ? isWork : overlay.classList.contains('work')
            );
        }
    }
});

// 确保页面关闭时清理计时器
window.addEventListener('unload', () => {
    stopLocalTimer();
});
 