class PomodoroTimer {
    constructor() {
        this.currentIsWork = true;
        this.loadState();
        
        // DOM元素
        this.timerDisplay = document.getElementById('timer');
        this.workDurationInput = document.getElementById('workDuration');
        this.breakDurationInput = document.getElementById('breakDuration');
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        
        // 绑定事件处理器
        this.bindEvents();
        
        // 添加消息监听
        this.setupMessageListener();
    }

    async loadState() {
        const data = await chrome.storage.local.get([
            'timeLeft', 'isWork', 'timerState',
            'workDuration', 'breakDuration'
        ]);
        
        this.currentIsWork = data.isWork ?? true;
        
        if (data.workDuration) this.workDurationInput.value = data.workDuration;
        if (data.breakDuration) this.breakDurationInput.value = data.breakDuration;
        
        if (typeof data.timeLeft !== 'undefined' && typeof data.isWork !== 'undefined') {
            this.updateDisplay(data.timeLeft, data.isWork);
        }
        
        this.updateButtonStates(data.timerState === 'running');
    }

    updateButtonStates(isRunning) {
        this.startBtn.disabled = isRunning;
        this.pauseBtn.disabled = !isRunning;
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());
        
        // 监听输入框变化
        this.workDurationInput.addEventListener('change', () => this.updateDuration());
        this.breakDurationInput.addEventListener('change', () => this.updateDuration());
        
        // 监听存储变化
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.timeLeft || changes.isWork) {
                const timeLeft = changes.timeLeft ? changes.timeLeft.newValue : undefined;
                const isWork = changes.isWork ? changes.isWork.newValue : undefined;
                
                // 如果 timeLeft 变化了，就更新显示
                if (typeof timeLeft !== 'undefined') {
                    this.updateDisplay(
                        timeLeft,
                        typeof isWork !== 'undefined' ? isWork : this.currentIsWork
                    );
                }
            }
        });
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    updateDisplay(timeLeft, isWork) {
        if (typeof timeLeft === 'undefined') {
            return;
        }
        
        this.currentIsWork = isWork ?? this.currentIsWork;
        const timeString = this.formatTime(timeLeft);
        this.timerDisplay.textContent = timeString;
        
        this.sendMessageToContent({
            type: 'UPDATE_TIMER',
            time: timeString,
            isWork: isWork
        });
    }

    async updateDuration() {
        await chrome.storage.local.set({
            workDuration: parseInt(this.workDurationInput.value),
            breakDuration: parseInt(this.breakDurationInput.value)
        });
    }

    async start() {
        await chrome.storage.local.set({ timerState: 'running' });
        this.updateButtonStates(true);
        
        // 通知 background script 开始计时
        chrome.runtime.sendMessage({ type: 'START_TIMER' });
        
        // 通知 content script 更新状态
        this.sendMessageToContent({
            type: 'START_TIMER',
            action: 'play'
        });
    }

    async pause() {
        await chrome.storage.local.set({ timerState: 'paused' });
        this.updateButtonStates(false);
        
        // 通知 background script 停止计时
        chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
        
        // 通知 content script 更新状态
        this.sendMessageToContent({
            type: 'PAUSE_TIMER',
            action: 'pause'
        });
    }

    async reset() {
        this.pause();
        const newTimeLeft = this.workDurationInput.value * 60;
        
        await chrome.storage.local.set({
            isWork: true,
            timeLeft: newTimeLeft
        });

        // 手动触发一次更新显示
        this.updateDisplay(newTimeLeft, true);
    }

    sendMessageToContent(message) {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]?.url?.includes('youtube.com')) {
                chrome.tabs.sendMessage(tabs[0].id, message);
            }
        });
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'UPDATE_BUTTON_STATE') {
                this.updateButtonStates(message.isRunning);
            }
        });
    }
}

// 初始化计时器
document.addEventListener('DOMContentLoaded', () => {
    new PomodoroTimer();
});