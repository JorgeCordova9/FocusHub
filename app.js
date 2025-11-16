// ===== AUTHENTICATION STATE =====
let authState = {
  isLoggedIn: false,
  userId: null,
  email: null,
};

// UI State
let uiState = {
  sidebarOpen: true,
  musicPlaying: false,
  currentTheme: null, // will be set on init
};

// Data Storage (In-Memory)
let appData = {
  tasks: [],
  copiedCitation: null,
  focusStats: {
    sessionsToday: 0,
    totalTime: 0,
    currentStreak: 0,
  },
  dailyGoal: {
    targetMinutes: 60,
    completedMinutes: 0,
  },
  currentTask: null,
  inTaskWorkspace: false,
  timer: {
    duration: 25 * 60,
    remaining: 25 * 60,
    isRunning: false,
    interval: null,
    isBreak: false,
  },
  pomodoroTimer: {
    workTime: 25,
    breakTime: 5,
    rounds: 5,
    currentRound: 0,
    isActive: false,
    isRunning: false,
    isBreak: false,
    remainingSeconds: 0,
    totalSeconds: 0,
    interval: null,
  },
  countdownTimer: {
    isRunning: false,
    remainingSeconds: 0,
    totalSeconds: 0,
    interval: null,
  },
  stopwatchTimer: {
    isRunning: false,
    elapsedSeconds: 0,
    interval: null,
  },
  currentUrl: "",
};

// Whiteboard State
let canvas, ctx;
let isDrawing = false;
let currentTool = "pencil";
let currentColor = "#000000";
let currentSize = 3;
let startX, startY;
let canvasHistory = [];
let savedImageData = null;

// Image tracking for whiteboard
let canvasImages = [];
let selectedImage = null;
let isDraggingImage = false;
let isResizingImage = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let canvasSnapshot = null; // Store canvas drawing state

// Music Player State
let currentPlaylistType = null;
let musicPlayerAPI = null;
let isMusicPlaying = false;

// Playlists with embed URLs (YouTube only) - Long duration videos
const playlists = {
  lofi: "https://www.youtube.com/embed/jfKfPfyJRdk",
  classical: "https://www.youtube.com/embed/iTC49Hi4hb8",
  ambient: "https://www.youtube.com/embed/-VgN7nKx9MU",
  nature: "https://www.youtube.com/embed/lE6RYpe9IT0",
  whitenoise: "https://www.youtube.com/embed/ArwcHjmsw3A",
};

const motivationalMessages = [
  "Great work! You stayed focused!",
  "Session complete! Take a break.",
  "You're building great study habits!",
  "Focus streak maintained!",
  "Another successful session!",
];

// Initialize App
window.addEventListener("DOMContentLoaded", () => {
  // Check authentication first
  checkAuthenticationStatus();
});

// Check if user is authenticated
async function checkAuthenticationStatus() {
  try {
    const response = await fetch("/api/auth/check", {
      credentials: "include",
    });
    const data = await response.json();

    if (data.authenticated) {
      authState.isLoggedIn = true;
      authState.userId = data.userId;
      authState.email = data.email;
      initializeApp();
    } else {
      // Allow anonymous mode - initialize app without authentication
      authState.isLoggedIn = false;
      initializeApp();
    }
  } catch (error) {
    console.error("Auth check failed:", error);
    // Allow anonymous mode on error
    authState.isLoggedIn = false;
    initializeApp();
  }
}

// Initialize App after authentication
function initializeApp() {
  initializeTheme();
  initializeWhiteboard();
  updateFocusStats();
  updateTopTimerDisplay();
  // Load tasks from server or from local storage for anonymous users
  loadTasksDependingOnAuth();

  // If authenticated, offer to sync any local tasks created while anonymous
  if (authState.isLoggedIn) {
    setTimeout(() => {
      syncLocalToServerIfNeeded();
    }, 800);
  }

  // Start on task dashboard (no browser visible)
  switchModule("tasks");

  // Show welcome modal
  document.getElementById("welcomeModal").style.display = "flex";

  // Update user info in UI
  updateUserDisplay();
}

// Logo Click Handler - Always return to home/dashboard
function logoClickHandler() {
  if (appData.inTaskWorkspace) {
    exitTaskWorkspace();
  }
  switchModule("tasks");
}

// ===== MODULE SWITCHING =====
function switchModule(moduleName) {
  document.querySelectorAll(".module").forEach((mod) => {
    mod.classList.remove("active");
  });

  document.querySelectorAll(".sidebar button").forEach((btn) => {
    btn.classList.remove("active");
  });

  const targetModule = document.getElementById(moduleName + "Module");
  if (targetModule) {
    targetModule.classList.add("active");
  }

  const menuBtn = document.querySelector(
    `.sidebar button[onclick*="${moduleName}"]`
  );
  if (menuBtn) {
    menuBtn.classList.add("active");
  }

  if (moduleName === "tasks") {
    document.getElementById("currentTaskDisplay").innerText = "Task Dashboard";
  }

  if (appData.inTaskWorkspace) {
    appData.inTaskWorkspace = false;
    stopAllTimers();
  }
}

// Add keyboard listener for deleting images
document.addEventListener("keydown", (e) => {
  if (e.key === "Delete" && selectedImage) {
    deleteSelectedImage();
  }
});

// Logo Click Handler - Always return to home/dashboard
function logoClickHandler() {
  // If in task workspace, exit and return to dashboard
  if (appData.inTaskWorkspace && appData.currentTask) {
    exitTaskWorkspace();
  }

  // Always switch to dashboard view
  appData.inTaskWorkspace = false;
  document.getElementById("dashboardSidebar").style.display = "flex";
  document.getElementById("workspaceSidebar").style.display = "none";

  // Hide all modules and show task dashboard
  document
    .querySelectorAll(".module")
    .forEach((m) => m.classList.remove("active"));
  document.getElementById("taskDashboard").classList.add("active");

  // Update nav buttons
  document
    .querySelectorAll(".nav-btn")
    .forEach((btn) => btn.classList.remove("active"));
  const tasksBtn = document.querySelector(
    '#dashboardSidebar .nav-btn[onclick*="tasks"]'
  );
  if (tasksBtn) tasksBtn.classList.add("active");

  // Reset current task
  appData.currentTask = null;

  // Update timer display
  updateTopTimerDisplay();
  updateTaskTimerControls();
}

// Update user display in UI
function updateUserDisplay() {
  const userDisplay = document.querySelector(".app-title");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (loginBtn && logoutBtn) {
    if (authState.isLoggedIn) {
      loginBtn.style.display = "none";
      logoutBtn.style.display = "block";
    } else {
      loginBtn.style.display = "block";
      logoutBtn.style.display = "none";
    }
  }

  if (userDisplay && authState.email) {
    userDisplay.title = `Logged in as: ${authState.email}`;
  }
}

// Logout function
async function logout() {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    const data = await response.json();
    if (data.success) {
      authState.isLoggedIn = false;
      authState.userId = null;
      authState.email = null;
      // Stay on the main page but switch to anonymous mode
      loadTasksDependingOnAuth();
      showNotification("✓ Logged out");
    }
  } catch (error) {
    console.error("Logout error:", error);
    // On error, still switch to anonymous mode
    authState.isLoggedIn = false;
    authState.userId = null;
    authState.email = null;
    loadTasksDependingOnAuth();
  }
}

// Sidebar Toggle
function toggleSidebar() {
  uiState.sidebarOpen = !uiState.sidebarOpen;

  // Get the active sidebar (dashboard or workspace)
  const activeSidebar = appData.inTaskWorkspace
    ? document.getElementById("workspaceSidebar")
    : document.getElementById("dashboardSidebar");

  const contentArea = document.querySelector(".content-area");
  const floatingBtn = document.querySelector(".hamburger-btn-floating");

  if (uiState.sidebarOpen) {
    activeSidebar.classList.remove("collapsed");
    contentArea.classList.remove("expanded");
    if (floatingBtn) floatingBtn.style.display = "none";
  } else {
    activeSidebar.classList.add("collapsed");
    contentArea.classList.add("expanded");
    if (floatingBtn) floatingBtn.style.display = "flex";
  }
}

function closeWelcome() {
  document.getElementById("welcomeModal").style.display = "none";
}

// ===== THEME TOGGLE FUNCTIONS =====
function initializeTheme() {
  // Check if user has a saved theme preference
  // Since we can't use localStorage, check system preference
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  // Set initial theme based on system preference
  uiState.currentTheme = prefersDark ? "dark" : "light";

  // Apply theme
  applyTheme(uiState.currentTheme);

  // Update toggle button
  updateThemeToggleButton();
}

function toggleTheme() {
  // Switch theme
  uiState.currentTheme = uiState.currentTheme === "light" ? "dark" : "light";

  // Apply new theme
  applyTheme(uiState.currentTheme);

  // Update toggle button
  updateThemeToggleButton();
}

function applyTheme(theme) {
  // Apply data-theme attribute to body
  document.body.setAttribute("data-theme", theme);
}

function updateThemeToggleButton() {
  const toggleBtn = document.getElementById("themeToggle");
  if (!toggleBtn) return;

  // Light mode shows moon (click to go dark)
  // Dark mode shows sun (click to go light)
  if (uiState.currentTheme === "light") {
    toggleBtn.textContent = "🌙";
    toggleBtn.title = "Switch to dark mode";
  } else {
    toggleBtn.textContent = "☀️";
    toggleBtn.title = "Switch to light mode";
  }
}

// Module Switching - Dashboard Mode
function switchModule(moduleName) {
  if (appData.inTaskWorkspace) return;

  // Update active state on nav buttons
  document.querySelectorAll("#dashboardSidebar .nav-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Hide all modules
  document
    .querySelectorAll(".module")
    .forEach((m) => m.classList.remove("active"));

  // Show selected module and highlight corresponding nav button
  if (moduleName === "music") {
    document.getElementById("musicModule").classList.add("active");
    const musicBtn = document.querySelector(
      '#dashboardSidebar .nav-btn[onclick*="music"]'
    );
    if (musicBtn) musicBtn.classList.add("active");
  } else if (moduleName === "tasks") {
    document.getElementById("taskDashboard").classList.add("active");
    const tasksBtn = document.querySelector(
      '#dashboardSidebar .nav-btn[onclick*="tasks"]'
    );
    if (tasksBtn) tasksBtn.classList.add("active");
  }
  // Browser is NOT available on dashboard
}

// Module Switching - Task Workspace Mode
function switchTaskModule(moduleName) {
  if (!appData.inTaskWorkspace || !appData.currentTask) return;

  // Hide all modules
  document
    .querySelectorAll(".module")
    .forEach((m) => m.classList.remove("active"));
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.remove("active"));

  // Show selected module
  document.getElementById(moduleName + "Module").classList.add("active");
  event.target.closest(".nav-btn").classList.add("active");

  // Load task-specific data
  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task) return;

  if (moduleName === "notes") {
    loadTaskNotes(task);
  } else if (moduleName === "whiteboard") {
    loadTaskWhiteboard(task);
  } else if (moduleName === "browser") {
    initializeBrowser();
  }
}

// ===== CUSTOMIZABLE POMODORO TIMER =====
function updateSliderValue(type, value) {
  value = parseInt(value);

  if (type === "workTime") {
    appData.pomodoroTimer.workTime = value;
    document.getElementById("workTimeValue").textContent = value + " min";
  } else if (type === "breakTime") {
    appData.pomodoroTimer.breakTime = value;
    document.getElementById("breakTimeValue").textContent = value + " min";
  } else if (type === "rounds") {
    appData.pomodoroTimer.rounds = value;
    document.getElementById("roundsValue").textContent = value + " rounds";
  }
}

function startPomodoroSession() {
  // Initialize session
  appData.pomodoroTimer.isActive = true;
  appData.pomodoroTimer.currentRound = 0;
  appData.pomodoroTimer.isBreak = false;

  // Update panel UI
  document.getElementById("startPomodoroBtn").style.display = "none";
  document.getElementById("runningControls").style.display = "flex";

  // Start first work phase
  startPomodoroPhase(false);
}

function startPomodoroPhase(isBreak) {
  appData.pomodoroTimer.isBreak = isBreak;

  if (isBreak) {
    appData.pomodoroTimer.remainingSeconds =
      appData.pomodoroTimer.breakTime * 60;
    appData.pomodoroTimer.totalSeconds = appData.pomodoroTimer.breakTime * 60;
  } else {
    appData.pomodoroTimer.remainingSeconds =
      appData.pomodoroTimer.workTime * 60;
    appData.pomodoroTimer.totalSeconds = appData.pomodoroTimer.workTime * 60;
  }

  updatePomodoroDisplay();
  appData.pomodoroTimer.isRunning = true;

  // Update pause button in panel
  const pauseBtn = document.getElementById("pauseBtn");
  if (pauseBtn) {
    pauseBtn.textContent = "⏸ Pause";
  }

  appData.pomodoroTimer.interval = setInterval(() => {
    if (appData.pomodoroTimer.remainingSeconds > 0) {
      appData.pomodoroTimer.remainingSeconds--;
      updatePomodoroDisplay();
    } else {
      completePomodoroPhase();
    }
  }, 1000);
}

function updatePomodoroDisplay() {
  // Update top-right timer display
  updateTopTimerDisplay();
  updateTaskTimerControls();
}

function completePomodoroPhase() {
  clearInterval(appData.pomodoroTimer.interval);
  appData.pomodoroTimer.isRunning = false;

  if (appData.pomodoroTimer.isBreak) {
    // Break complete, check if more rounds
    if (appData.pomodoroTimer.currentRound >= appData.pomodoroTimer.rounds) {
      // All rounds complete!
      completePomodoroSession();
    } else {
      // Start next work phase
      showPhaseTransition("Back to work!", () => {
        startPomodoroPhase(false);
      });
    }
  } else {
    // Work phase complete
    appData.pomodoroTimer.currentRound++;

    // Update focus stats
    appData.focusStats.sessionsToday++;
    appData.focusStats.currentStreak++;
    appData.focusStats.totalTime += appData.pomodoroTimer.workTime;
    updateFocusStats();

    // Update task time if active
    if (appData.currentTask) {
      const task = appData.tasks.find((t) => t.id === appData.currentTask);
      if (task) {
        task.timeSpent += appData.pomodoroTimer.workTime;
      }
    }

    renderRoundsIndicator();

    if (appData.pomodoroTimer.currentRound >= appData.pomodoroTimer.rounds) {
      // All work rounds complete!
      completePomodoroSession();
    } else {
      // Start break
      showPhaseTransition("Break time!", () => {
        startPomodoroPhase(true);
      });
    }
  }
}

function showPhaseTransition(message, callback) {
  // Simple transition - just proceed to next phase
  setTimeout(callback, 1000);
}

function pausePomodoroTimer() {
  const pauseBtn = document.getElementById("pauseBtn");

  if (appData.pomodoroTimer.isRunning) {
    clearInterval(appData.pomodoroTimer.interval);
    appData.pomodoroTimer.isRunning = false;
    if (pauseBtn) pauseBtn.textContent = "▶ Resume";
  } else {
    appData.pomodoroTimer.isRunning = true;
    if (pauseBtn) pauseBtn.textContent = "⏸ Pause";
    appData.pomodoroTimer.interval = setInterval(() => {
      if (appData.pomodoroTimer.remainingSeconds > 0) {
        appData.pomodoroTimer.remainingSeconds--;
        updatePomodoroDisplay();
      } else {
        completePomodoroPhase();
      }
    }, 1000);
  }
}

function stopPomodoroSession() {
  if (confirm("Stop timer session?")) {
    clearInterval(appData.pomodoroTimer.interval);
    appData.pomodoroTimer.isActive = false;
    appData.pomodoroTimer.isRunning = false;
    appData.pomodoroTimer.currentRound = 0;

    // Reset panel UI
    document.getElementById("startPomodoroBtn").style.display = "block";
    const runningControls = document.getElementById("runningControls");
    if (runningControls) runningControls.style.display = "none";

    // Reset top display
    updateTopTimerDisplay();
  }
}

function completePomodoroSession() {
  clearInterval(appData.pomodoroTimer.interval);

  const message =
    motivationalMessages[
      Math.floor(Math.random() * motivationalMessages.length)
    ];
  document.getElementById(
    "motivationalMessage"
  ).textContent = `${message}\n\nCompleted ${appData.pomodoroTimer.currentRound} rounds!`;
  document.getElementById("timerCompleteModal").style.display = "flex";

  appData.pomodoroTimer.isActive = false;
  appData.pomodoroTimer.isRunning = false;
  appData.pomodoroTimer.currentRound = 0;

  // Reset panel UI
  document.getElementById("startPomodoroBtn").style.display = "block";
  const runningControls = document.getElementById("runningControls");
  if (runningControls) runningControls.style.display = "none";

  // Reset top display
  updateTopTimerDisplay();
  updateTaskTimerControls();
}

// Timer panel removed - no click listener needed

// ===== TASK TIMER FUNCTIONS =====
function startTaskTimer(task) {
  if (!task) return;

  // Initialize timer with task duration
  const timeRemaining = Math.max(0, task.timeAllocated - task.timeSpent);
  appData.timer.duration = timeRemaining * 60; // Convert to seconds
  appData.timer.remaining = timeRemaining * 60;
  appData.timer.isRunning = true;

  // Start countdown
  appData.timer.interval = setInterval(() => {
    if (appData.timer.remaining > 0) {
      appData.timer.remaining--;
      task.timeSpent += 1 / 60; // Add 1 second as fraction of minute
      updateTopTimerDisplay();
    } else {
      // Timer complete
      completeTaskTimer(task);
    }
  }, 1000);

  // Add visual indicator
  const timerDisplay = document.querySelector(".timer-display");
  if (timerDisplay) {
    timerDisplay.classList.add("task-mode");
  }

  // Update tooltip
  const timerCircle = document.getElementById("timerCircle");
  if (timerCircle) {
    timerCircle.title = "Click to pause timer";
  }

  updateTopTimerDisplay();
  updateTaskTimerControls();
  showNotification(
    "⏱️ Timer Started: " + Math.floor(timeRemaining) + " minutes"
  );
}

function pauseTaskTimer() {
  if (!appData.timer.isRunning) return;

  clearInterval(appData.timer.interval);
  appData.timer.isRunning = false;

  // Update visual indicator
  const timerDisplay = document.querySelector(".timer-display");
  if (timerDisplay) {
    timerDisplay.style.opacity = "0.7";
  }

  // Update tooltip
  const timerCircle = document.getElementById("timerCircle");
  if (timerCircle) {
    timerCircle.title = "Click to resume timer";
  }

  updateTopTimerDisplay();
  updateTaskTimerControls();
}

function resumeTaskTimer() {
  if (appData.timer.isRunning || !appData.currentTask) return;

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task) return;

  appData.timer.isRunning = true;

  appData.timer.interval = setInterval(() => {
    if (appData.timer.remaining > 0) {
      appData.timer.remaining--;
      task.timeSpent += 1 / 60;
      updateTopTimerDisplay();
    } else {
      completeTaskTimer(task);
    }
  }, 1000);

  // Update visual indicator
  const timerDisplay = document.querySelector(".timer-display");
  if (timerDisplay) {
    timerDisplay.style.opacity = "1";
  }

  // Update tooltip
  const timerCircle = document.getElementById("timerCircle");
  if (timerCircle) {
    timerCircle.title = "Click to pause timer";
  }

  updateTopTimerDisplay();
  updateTaskTimerControls();
}

function stopTaskTimer() {
  clearInterval(appData.timer.interval);
  appData.timer.isRunning = false;
  appData.timer.remaining = 0;

  // Remove visual indicator
  const timerDisplay = document.querySelector(".timer-display");
  if (timerDisplay) {
    timerDisplay.classList.remove("task-mode");
  }
}

function completeTaskTimer(task) {
  clearInterval(appData.timer.interval);
  appData.timer.isRunning = false;

  // Mark task as completed
  task.status = "completed";

  // Update stats
  appData.focusStats.sessionsToday++;
  appData.focusStats.currentStreak++;
  appData.focusStats.totalTime += Math.floor(task.timeAllocated);
  updateFocusStats();

  // Update daily goal progress
  appData.dailyGoal.completedMinutes += Math.floor(task.timeSpent);
  updateDailyGoalDisplay();

  // Sync with server
  updateTaskOnServer(task);

  // Show completion modal with options
  showTaskCompletionModal(task);

  updateTopTimerDisplay();
  updateTaskTimerControls();
}

// Sync task changes to server
async function updateTaskOnServer(task) {
  // If user is anonymous, just persist locally
  if (!authState.isLoggedIn) {
    saveLocalTasks();
    return;
  }

  try {
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        nombre: task.name || task.nombre,
        timeAllocated: task.timeAllocated,
        timeSpent: task.timeSpent,
        status: task.status,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      console.error("Error syncing task:", data.message);
    }
  } catch (error) {
    console.error("Error updating task on server:", error);
  }
}

function showTaskCompletionModal(task) {
  const timeUsed = Math.floor(task.timeSpent);
  const timeAllocated = Math.floor(task.timeAllocated);

  const message = `🎉 Task Completed!\n\nTask: ${task.name}\nTime Allocated: ${timeAllocated} minutes\nTime Used: ${timeUsed} minutes`;

  if (
    confirm(message + "\n\nExit to dashboard? (Cancel to continue working)")
  ) {
    exitTaskWorkspace();
  }
}

function toggleTaskTimer() {
  // Only allow timer interaction when in task workspace
  if (!appData.currentTask || !appData.inTaskWorkspace) {
    // Not in task - do nothing (dashboard timer is non-interactive)
    return;
  }

  // In task - toggle pause/resume
  if (appData.timer.isRunning) {
    pauseTaskTimer();
    showNotification("⏸️ Timer Paused");
  } else {
    resumeTaskTimer();
    showNotification("▶️ Timer Resumed");
  }
}

// ===== INTEGRATED TIMER PANEL ===== (REMOVED - NO LONGER FUNCTIONAL)
function toggleTimerPanel() {
  // Timer panel completely removed - do nothing
  return;
}

function startPomodoroFromPanel() {
  // Pomodoro panel removed - do nothing
  return;
}

function updateTaskTimerControls() {
  const timerControls = document.getElementById("taskTimerControls");

  if (!timerControls) return;

  // Show controls only when in task workspace with active task
  if (appData.inTaskWorkspace && appData.currentTask) {
    const task = appData.tasks.find((t) => t.id === appData.currentTask);

    if (task && task.status !== "completed") {
      timerControls.classList.remove("hidden");

      // Update pause button text based on timer state
      const pauseBtn = document.getElementById("taskPauseBtn");
      if (pauseBtn) {
        pauseBtn.textContent = appData.timer.isRunning ? "⏸ Pause" : "▶ Resume";
      }
    } else {
      timerControls.classList.add("hidden");
    }
  } else {
    timerControls.classList.add("hidden");
  }
}

function finishTaskEarly() {
  if (!appData.currentTask || !appData.inTaskWorkspace) return;

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task) return;

  // Stop the timer
  clearInterval(appData.timer.interval);
  appData.timer.isRunning = false;

  // Mark task as completed
  task.status = "completed";

  // Update stats
  appData.focusStats.sessionsToday++;
  appData.focusStats.currentStreak++;
  appData.focusStats.totalTime += Math.floor(task.timeSpent);
  updateFocusStats();

  // Update daily goal progress
  appData.dailyGoal.completedMinutes += Math.floor(task.timeSpent);
  updateDailyGoalDisplay();

  // Show completion message
  const timeUsed = Math.floor(task.timeSpent);
  const timeAllocated = Math.floor(task.timeAllocated);

  const message = `✅ Task Completed!\n\nTask: ${
    task.name
  }\nTime Used: ${timeUsed} min / ${timeAllocated} min allocated\n\nYou finished ${
    timeAllocated - timeUsed
  } minutes early!`;

  if (confirm(message + "\n\nReturn to dashboard?")) {
    exitTaskWorkspace();
  } else {
    // Update UI to reflect completion
    updateTopTimerDisplay();
    updateTaskTimerControls();
  }
}

function pauseOrResumeTaskTimer() {
  if (!appData.currentTask || !appData.inTaskWorkspace) return;

  if (appData.timer.isRunning) {
    pauseTaskTimer();
    showNotification("⏸️ Timer Paused");
  } else {
    resumeTaskTimer();
    showNotification("▶️ Timer Resumed");
  }

  updateTaskTimerControls();
}

function stopTaskTimerEarly() {
  if (!appData.currentTask || !appData.inTaskWorkspace) return;

  if (
    confirm(
      "Stop timer and exit without completing? (Task will remain incomplete)"
    )
  ) {
    exitTaskWorkspace();
  }
}

function updateTopTimerDisplay() {
  // Check if we have an active task
  if (appData.currentTask && appData.inTaskWorkspace) {
    const task = appData.tasks.find((t) => t.id === appData.currentTask);
    if (task && appData.timer.isRunning) {
      // Show task-specific countdown timer
      const timeRemaining = Math.max(0, task.timeAllocated - task.timeSpent);
      const minutes = Math.floor(appData.timer.remaining / 60);
      const seconds = appData.timer.remaining % 60;

      document.getElementById("timerText").textContent = `${minutes}:${seconds
        .toString()
        .padStart(2, "0")}`;
      document.getElementById("timerPhase").textContent =
        task.name.length > 15 ? task.name.substring(0, 15) + "..." : task.name;
      document.getElementById(
        "timerRounds"
      ).innerHTML = `<span style="font-size: 10px; color: var(--color-text-secondary);">${Math.floor(
        timeRemaining
      )}m / ${Math.floor(task.timeAllocated)}m</span>`;

      // Update circular progress based on countdown
      const progress =
        task.timeAllocated > 0
          ? appData.timer.remaining / (task.timeAllocated * 60)
          : 0;
      const strokeOffset = 163.36 - progress * 163.36;
      document.getElementById("timerProgress").style.strokeDashoffset =
        strokeOffset;

      return;
    } else if (task) {
      // Timer paused or stopped
      const timeRemaining = Math.max(0, task.timeAllocated - task.timeSpent);
      const minutes = Math.floor(timeRemaining);
      const timeAllocatedMin = Math.floor(task.timeAllocated);

      document.getElementById("timerText").textContent = `${minutes}m`;
      document.getElementById("timerPhase").textContent =
        task.name.length > 15 ? task.name.substring(0, 15) + "..." : task.name;
      document.getElementById(
        "timerRounds"
      ).innerHTML = `<span style="font-size: 10px; color: var(--color-text-secondary);">${minutes}m / ${timeAllocatedMin}m</span>`;

      const progress =
        task.timeAllocated > 0 ? task.timeSpent / task.timeAllocated : 0;
      const strokeOffset = 163.36 - progress * 163.36;
      document.getElementById("timerProgress").style.strokeDashoffset =
        strokeOffset;

      return;
    }
  }

  // Show "No Active Task" when on dashboard
  if (!appData.inTaskWorkspace) {
    document.getElementById("timerText").textContent = "--";
    document.getElementById("timerPhase").textContent = "No Active Task";
    document.getElementById("timerRounds").innerHTML =
      '<span style="font-size: 9px; color: var(--color-text-secondary);">Status only</span>';
    document.getElementById("timerProgress").style.strokeDashoffset = 163.36;

    // Remove task mode indicator
    const timerDisplay = document.querySelector(".timer-display");
    if (timerDisplay) {
      timerDisplay.classList.remove("task-mode");
      timerDisplay.style.opacity = "1";
      timerDisplay.style.cursor = "default";
    }

    // Update tooltip for dashboard mode - non-interactive
    const timerCircle = document.getElementById("timerCircle");
    if (timerCircle) {
      timerCircle.title = "Timer inactive - start a task to use timer";
      timerCircle.style.cursor = "default";
    }

    return;
  }

  // Fallback: Show Pomodoro timer if active but no task
  if (appData.pomodoroTimer.isActive) {
    // Update countdown
    const minutes = Math.floor(appData.pomodoroTimer.remainingSeconds / 60);
    const seconds = appData.pomodoroTimer.remainingSeconds % 60;
    document.getElementById("timerText").textContent = `${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    // Update phase
    document.getElementById("timerPhase").textContent = appData.pomodoroTimer
      .isBreak
      ? "Break"
      : "Work";

    // Update rounds indicator
    const roundsHtml = [];
    for (let i = 0; i < appData.pomodoroTimer.rounds; i++) {
      const completed = i < appData.pomodoroTimer.currentRound;
      roundsHtml.push(
        `<div class="timer-round-dot ${completed ? "completed" : ""}"></div>`
      );
    }
    document.getElementById("timerRounds").innerHTML = roundsHtml.join("");

    // Update circular progress
    const progress =
      (appData.pomodoroTimer.remainingSeconds /
        appData.pomodoroTimer.totalSeconds) *
      163.36;
    document.getElementById("timerProgress").style.strokeDashoffset =
      163.36 - progress;
  }
}

function closeTimerComplete() {
  document.getElementById("timerCompleteModal").style.display = "none";
}

function updateFocusStats() {
  document.getElementById("sessionsToday").textContent =
    appData.focusStats.sessionsToday;
  document.getElementById("currentStreak").textContent =
    appData.focusStats.currentStreak;
}

// ===== BROWSER FUNCTIONS - SEARCH RESULTS MODE =====

// Browser State
let browserState = {
  tabs: [],
  activeTabId: null,
  nextTabId: 1,
};

function initializeBrowser() {
  // Show browser interface
  document.getElementById("browserInterface").style.display = "flex";

  // Update browser branding
  document.getElementById("browserBrandIcon").textContent = "🔍";
  document.getElementById("browserBrandName").textContent = "Search Browser";

  // Create initial tab if none exist AND load welcome content
  if (browserState.tabs.length === 0) {
    createNewTab("", "New Search");
  }

  // ALWAYS display the active tab content (fix for empty screen on entry)
  if (browserState.activeTabId) {
    displayTabInfo(browserState.activeTabId);
  }
}

function createNewTab(query = "", title = "New Search") {
  const tab = {
    id: browserState.nextTabId++,
    query: query,
    title: title,
    results: [],
    timestamp: new Date().toLocaleString(),
    history: [],
    historyIndex: -1,
    isLoading: false,
  };

  browserState.tabs.push(tab);
  browserState.activeTabId = tab.id;

  renderTabs();

  // Perform search if query provided
  if (query) {
    performSearch(query, tab.id);
  } else {
    displayTabInfo(tab.id);
  }
}

function switchTab(tabId) {
  browserState.activeTabId = tabId;
  renderTabs();
  displayTabInfo(tabId);
}

function closeTab(tabId) {
  const tabIndex = browserState.tabs.findIndex((t) => t.id === tabId);
  if (tabIndex === -1) return;

  // Don't allow closing the last tab
  if (browserState.tabs.length === 1) {
    // Just clear it instead
    const tab = browserState.tabs[0];
    tab.url = "";
    tab.title = "New Tab";
    tab.history = [];
    tab.historyIndex = -1;
    renderTabs();
    displayTabInfo(tab.id);
    return;
  }

  // Remove tab
  browserState.tabs.splice(tabIndex, 1);

  // If closed tab was active, switch to another tab
  if (browserState.activeTabId === tabId) {
    const newActiveTab = browserState.tabs[Math.max(0, tabIndex - 1)];
    browserState.activeTabId = newActiveTab.id;
    displayTabInfo(newActiveTab.id);
  }

  renderTabs();
}

function renderTabs() {
  const tabBar = document.getElementById("browserTabBar");

  const tabsHtml = browserState.tabs
    .map(
      (tab) => `
    <div class="browser-tab ${
      tab.id === browserState.activeTabId ? "active" : ""
    }" onclick="switchTab(${tab.id})">
      <span class="browser-tab-title">${escapeHtml(tab.title)}</span>
      <button class="browser-tab-close" onclick="event.stopPropagation(); closeTab(${
        tab.id
      });">×</button>
    </div>
  `
    )
    .join("");

  tabBar.innerHTML =
    tabsHtml +
    '<button class="browser-tab-new" onclick="createNewTab()" title="New Tab">+</button>';
}

function displayTabInfo(tabId) {
  const tab = browserState.tabs.find((t) => t.id === tabId);
  if (!tab) return;

  const contentArea = document.getElementById("browserContentArea");
  const addressBar = document.getElementById("browserAddressBar");

  addressBar.value = tab.query || "";

  // Show loading state
  if (tab.isLoading) {
    contentArea.innerHTML = `
      <div class="browser-loading">
        <div class="browser-loading-spinner">⟳</div>
        <p style="margin-top: 16px; font-size: 16px;">Searching...</p>
      </div>
    `;
    return;
  }

  // Display search results if available
  if (tab.results && tab.results.length > 0) {
    displaySearchResults(tab);
  } else if (tab.query) {
    contentArea.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; text-align: center;">
        <div style="font-size: 64px; margin-bottom: 24px;">🔍</div>
        <h3 style="color: var(--color-text); margin-bottom: 16px; font-size: 24px;">No results found</h3>
        <p style="color: var(--color-text-secondary); margin-bottom: 8px; font-size: 16px;">Search query: "${escapeHtml(
          tab.query
        )}"</p>
        <p style="color: var(--color-text-secondary); margin-bottom: 24px; font-size: 14px;">Try a different search term</p>
      </div>
    `;
  } else {
    contentArea.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; text-align: center;">
        <div style="font-size: 64px; margin-bottom: 24px;">🔍</div>
        <h3 style="color: var(--color-text); margin-bottom: 16px; font-size: 24px;">Welcome to Search Browser</h3>
        <p style="color: var(--color-text-secondary); margin-bottom: 32px; font-size: 16px; max-width: 500px;">
          Enter a search term in the bar above to find information.
        </p>
        <div style="background: var(--color-bg-1); border: 1px solid var(--color-card-border); border-radius: 12px; padding: 24px; max-width: 500px;">
          <h4 style="color: var(--color-text); margin-bottom: 12px; font-size: 16px;">✨ How it works:</h4>
          <ul style="text-align: left; color: var(--color-text-secondary); font-size: 14px; line-height: 1.8;">
            <li>Type a search term (e.g., "Wikipedia" or "Python tutorial")</li>
            <li>Press Enter or click "Search"</li>
            <li>Browse search results as cards</li>
            <li>Click any result to open in a new tab</li>
            <li>No proxy errors or embedding issues!</li>
          </ul>
        </div>
      </div>
    `;
  }
}

async function performSearch(query, tabId) {
  const tab = browserState.tabs.find((t) => t.id === tabId);
  if (!tab) return;

  // Add to history if different query
  if (tab.query && tab.query !== query) {
    if (tab.historyIndex < tab.history.length - 1) {
      tab.history = tab.history.slice(0, tab.historyIndex + 1);
    }
    tab.history.push({
      query: tab.query,
      title: tab.title,
      results: tab.results,
    });
    tab.historyIndex = tab.history.length - 1;
  }

  tab.query = query;
  tab.isLoading = true;
  tab.results = [];
  tab.title = `Search: ${query.substring(0, 20)}${
    query.length > 20 ? "..." : ""
  }`;

  if (browserState.activeTabId === tabId) {
    displayTabInfo(tabId);
  }

  // Generate simulated search results
  tab.results = generateSearchResults(query);

  tab.isLoading = false;
  tab.timestamp = new Date().toLocaleString();

  renderTabs();
  if (browserState.activeTabId === tabId) {
    displayTabInfo(tabId);
  }
}

function generateSearchResults(query) {
  // Simulated search results based on query
  const lowerQuery = query.toLowerCase();
  const results = [];

  // Generate 8 relevant results
  if (lowerQuery.includes("wikipedia") || lowerQuery.includes("wiki")) {
    results.push(
      {
        title: "Wikipedia - The Free Encyclopedia",
        url: "https://www.wikipedia.org",
        description:
          "Wikipedia is a free online encyclopedia, created and edited by volunteers around the world and hosted by the Wikimedia Foundation.",
      },
      {
        title: "Wikipedia - Main Page",
        url: "https://en.wikipedia.org/wiki/Main_Page",
        description:
          "The main page of the English Wikipedia. Browse millions of articles on any topic.",
      },
      {
        title: "How Wikipedia Works",
        url: "https://en.wikipedia.org/wiki/Wikipedia:About",
        description:
          "Learn about how Wikipedia is written, edited, and maintained by volunteers worldwide.",
      }
    );
  } else if (lowerQuery.includes("python")) {
    results.push(
      {
        title: "Python.org - Official Python Website",
        url: "https://www.python.org",
        description:
          "The official home of the Python Programming Language. Download Python, read documentation, and learn about Python development.",
      },
      {
        title: "Python Tutorial - W3Schools",
        url: "https://www.w3schools.com/python/",
        description:
          "Learn Python programming with easy-to-follow tutorials, examples, and exercises. Perfect for beginners.",
      },
      {
        title: "Python Documentation",
        url: "https://docs.python.org/3/",
        description:
          "Official documentation for Python 3. Comprehensive guides, library references, and tutorials.",
      }
    );
  } else if (lowerQuery.includes("javascript") || lowerQuery.includes("js")) {
    results.push(
      {
        title: "MDN Web Docs - JavaScript",
        url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
        description:
          "Comprehensive JavaScript documentation and tutorials from Mozilla Developer Network.",
      },
      {
        title: "JavaScript.info - The Modern JavaScript Tutorial",
        url: "https://javascript.info",
        description:
          "Learn JavaScript from basics to advanced topics with clear explanations and examples.",
      },
      {
        title: "JavaScript Tutorial - W3Schools",
        url: "https://www.w3schools.com/js/",
        description:
          "Easy to learn JavaScript tutorial with examples and exercises.",
      }
    );
  } else if (lowerQuery.includes("stack overflow")) {
    results.push(
      {
        title: "Stack Overflow - Where Developers Learn & Share",
        url: "https://stackoverflow.com",
        description:
          "The largest online community for programmers to learn, share knowledge, and build careers.",
      },
      {
        title: "Stack Overflow Questions",
        url: "https://stackoverflow.com/questions",
        description:
          "Browse millions of programming questions and answers from developers worldwide.",
      }
    );
  }

  // Add generic results based on query
  results.push(
    {
      title: `${query} - Search Results`,
      url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      description: `Search for "${query}" on DuckDuckGo for more comprehensive results.`,
    },
    {
      title: `${query} - Google Search`,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      description: `Find information about "${query}" using Google search engine.`,
    },
    {
      title: `${query} Articles and Resources`,
      url: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
      description: `Academic articles, papers, and scholarly resources related to "${query}".`,
    },
    {
      title: `Learn About ${query}`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        query
      )}`,
      description: `Video tutorials and educational content about "${query}" on YouTube.`,
    },
    {
      title: `${query} News and Updates`,
      url: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
      description: `Latest news and updates related to "${query}" from various sources.`,
    }
  );

  return results.slice(0, 8);
}

function displaySearchResults(tab) {
  const contentArea = document.getElementById("browserContentArea");

  const resultsHtml = `
    <div style="max-width: 900px; margin: 0 auto; padding: 20px;">
      <div style="margin-bottom: 24px;">
        <h3 style="color: var(--color-text); font-size: 20px; margin-bottom: 8px;">Search Results for "${escapeHtml(
          tab.query
        )}"</h3>
        <p style="color: var(--color-text-secondary); font-size: 14px;">${
          tab.results.length
        } results found • ${tab.timestamp}</p>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${tab.results
          .map(
            (result, index) => `
          <div style="background-color: var(--color-surface); border: 1px solid var(--color-card-border); border-radius: var(--radius-lg); padding: 20px; transition: box-shadow 0.2s, transform 0.2s;" 
               onmouseover="this.style.boxShadow='var(--shadow-md)'; this.style.transform='translateY(-2px)';" 
               onmouseout="this.style.boxShadow=''; this.style.transform='';">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
              <div style="flex: 1;">
                <a href="${
                  result.url
                }" target="_blank" style="color: var(--color-primary); font-size: 18px; font-weight: var(--font-weight-semibold); text-decoration: none; display: block; margin-bottom: 8px;" 
                   onmouseover="this.style.textDecoration='underline';" 
                   onmouseout="this.style.textDecoration='none';">
                  ${escapeHtml(result.title)}
                </a>
                <p style="color: var(--color-text-secondary); font-size: 12px; margin-bottom: 8px; word-break: break-all;">${escapeHtml(
                  result.url
                )}</p>
                <p style="color: var(--color-text); font-size: 14px; line-height: 1.6;">${escapeHtml(
                  result.description
                )}</p>
              </div>
              <button class="btn btn--primary" onclick="window.open('${escapeHtml(
                result.url
              )}', '_blank')" style="white-space: nowrap; flex-shrink: 0;">
                Open →
              </button>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
      
      <div style="margin-top: 32px; padding: 20px; background-color: var(--color-bg-3); border: 1px solid var(--color-card-border); border-radius: var(--radius-lg); text-align: center;">
        <p style="color: var(--color-text-secondary); font-size: 14px; margin-bottom: 12px;">💡 Tip: Click "Open →" to view any result in a new browser tab</p>
        <p style="color: var(--color-text-secondary); font-size: 12px;">All links open in your actual browser for full functionality</p>
      </div>
    </div>
  `;

  contentArea.innerHTML = resultsHtml;
}

function browserNavigate() {
  const addressBar = document.getElementById("browserAddressBar");
  let input = addressBar.value.trim();

  if (!input) return;

  const activeTab = browserState.tabs.find(
    (t) => t.id === browserState.activeTabId
  );
  if (activeTab) {
    performSearch(input, activeTab.id);
  }
}

function handleAddressBarEnter(event) {
  if (event.key === "Enter") {
    browserNavigate();
  }
}

function browserGoBack() {
  const activeTab = browserState.tabs.find(
    (t) => t.id === browserState.activeTabId
  );
  if (
    !activeTab ||
    activeTab.historyIndex < 0 ||
    activeTab.history.length === 0
  )
    return;

  // Save current state to history if navigating back
  if (activeTab.historyIndex === activeTab.history.length - 1) {
    activeTab.history.push({
      query: activeTab.query,
      title: activeTab.title,
      results: activeTab.results,
    });
  }

  const previousState = activeTab.history[activeTab.historyIndex];
  activeTab.query = previousState.query;
  activeTab.title = previousState.title;
  activeTab.results = previousState.results;
  activeTab.timestamp = new Date().toLocaleString();

  activeTab.historyIndex--;

  renderTabs();
  displayTabInfo(browserState.activeTabId);
}

function browserGoForward() {
  const activeTab = browserState.tabs.find(
    (t) => t.id === browserState.activeTabId
  );
  if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 2)
    return;

  activeTab.historyIndex++;
  const nextState = activeTab.history[activeTab.historyIndex + 1];
  activeTab.query = nextState.query;
  activeTab.title = nextState.title;
  activeTab.results = nextState.results;
  activeTab.timestamp = new Date().toLocaleString();

  renderTabs();
  displayTabInfo(browserState.activeTabId);
}

function browserRefresh() {
  const activeTab = browserState.tabs.find(
    (t) => t.id === browserState.activeTabId
  );
  if (!activeTab || !activeTab.query) return;

  performSearch(activeTab.query, activeTab.id);
}

function copyCitation() {
  const activeTab = browserState.tabs.find(
    (t) => t.id === browserState.activeTabId
  );
  if (activeTab && activeTab.query) {
    const date = new Date().toLocaleDateString();
    appData.copiedCitation = `Search: "${activeTab.query}" - ${date}`;
    alert("Citation copied! You can now insert it into your notes.");
  } else {
    alert("No active search to cite.");
  }
}

// ===== TASK-SPECIFIC NOTES FUNCTIONS =====

function loadTaskNotes(task) {
  const notesList = document.getElementById("notesList");

  if (!task.notes || task.notes.length === 0) {
    notesList.innerHTML =
      '<p style="color: var(--color-text-secondary); font-size: var(--font-size-sm); padding: var(--space-12);">No notes for this task yet</p>';
    clearNoteEditor();
    return;
  }

  notesList.innerHTML = task.notes
    .map(
      (note) => `
    <div class="note-item" style="position: relative; display: flex; align-items: center; justify-content: space-between;" onclick="loadTaskNote(${
      task.id
    }, ${note.id})">
      <div style="flex: 1; min-width: 0;">
        <div class="note-item-title">${escapeHtml(note.title)}</div>
        <div class="note-item-date">${new Date(
          note.timestamp
        ).toLocaleDateString()}</div>
      </div>
      <button class="note-delete-btn" onclick="event.stopPropagation(); deleteNoteFromList(${
        task.id
      }, ${
        note.id
      });" title="Delete note" style="opacity: 0; transition: opacity 0.2s; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 4px 8px; cursor: pointer; font-size: 14px; color: var(--color-text);">✕</button>
    </div>
  `
    )
    .join("");

  // Load first note or current note
  if (task.currentNote) {
    loadTaskNote(task.id, task.currentNote);
  } else if (task.notes.length > 0) {
    loadTaskNote(task.id, task.notes[0].id);
  }
}

function loadTaskNote(taskId, noteId) {
  const task = appData.tasks.find((t) => t.id === taskId);
  if (!task) return;

  const note = task.notes.find((n) => n.id === noteId);
  if (!note) return;

  task.currentNote = noteId;
  document.getElementById("noteTitle").value = note.title;
  document.getElementById("noteContent").innerHTML = note.content;

  const date = new Date(note.timestamp);
  document.getElementById(
    "noteTimestamp"
  ).textContent = `Created: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

  setTimeout(() => {
    initializeResizableDiagrams();
  }, 100);
}

function clearNoteEditor() {
  document.getElementById("noteTitle").value = "";
  document.getElementById("noteContent").innerHTML = "";
  document.getElementById("noteTimestamp").textContent = "";
}

function createNewNote() {
  if (!appData.currentTask) {
    alert("No active task. Notes are task-specific.");
    return;
  }

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task) return;

  const note = {
    id: Date.now(),
    title: "Untitled Note",
    content: "",
    timestamp: new Date().toISOString(),
  };

  if (!task.notes) task.notes = [];
  task.notes.push(note);
  task.currentNote = note.id;

  loadTaskNotes(task);
  loadTaskNote(task.id, note.id);
}

function saveCurrentNote() {
  if (!appData.currentTask) {
    alert("No active task");
    return;
  }

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task) return;

  saveTaskNote(task);
}

function saveTaskNote(task) {
  const note = {
    id: Date.now(),
    title: "Untitled Note",
    content: "",
    timestamp: new Date().toISOString(),
  };
  appData.notes.push(note);
  appData.currentNote = note.id;
  loadNote(note.id);
  renderNotesList();
}

function saveTaskNote(task) {
  const title = document.getElementById("noteTitle").value || "Untitled Note";
  const content = document.getElementById("noteContent").innerHTML;

  if (!task.currentNote) {
    // Create new note
    const note = {
      id: Date.now(),
      title: title,
      content: content,
      timestamp: new Date().toISOString(),
    };
    if (!task.notes) task.notes = [];
    task.notes.push(note);
    task.currentNote = note.id;

    const date = new Date(note.timestamp);
    document.getElementById(
      "noteTimestamp"
    ).textContent = `Created: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

    loadTaskNotes(task);
    showNotification("Note saved!");
    return;
  }

  // Update existing note
  const note = task.notes.find((n) => n.id === task.currentNote);
  if (note) {
    note.title = title;
    note.content = content;
    note.timestamp = new Date().toISOString();
    loadTaskNotes(task);
    showNotification("Note saved!");
  }
}

function deleteCurrentNote() {
  if (!appData.currentTask) return;

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task || !task.currentNote) {
    alert("No note selected to delete.");
    return;
  }

  if (confirm("Delete this note?")) {
    task.notes = task.notes.filter((n) => n.id !== task.currentNote);
    task.currentNote = null;
    clearNoteEditor();
    loadTaskNotes(task);
    showNotification("Note deleted.");
  }
}

function deleteNoteFromList(taskId, noteId) {
  const task = appData.tasks.find((t) => t.id === taskId);
  if (!task) return;

  if (confirm("Delete this note?")) {
    task.notes = task.notes.filter((n) => n.id !== noteId);

    // Clear editor if deleted note was currently loaded
    if (task.currentNote === noteId) {
      task.currentNote = null;
      clearNoteEditor();
    }

    loadTaskNotes(task);
    showNotification("Note deleted.");
  }
}

function formatText(command) {
  const editor = document.getElementById("noteContent");
  editor.focus();

  if (command === "h1" || command === "h2") {
    const formatBlock = command === "h1" ? "<h1>" : "<h2>";
    document.execCommand("formatBlock", false, formatBlock);
  } else {
    document.execCommand(command, false, null);
  }

  updateToolbarState();
}

function updateToolbarState() {
  const commands = [
    "bold",
    "italic",
    "underline",
    "insertUnorderedList",
    "insertOrderedList",
  ];
  commands.forEach((cmd) => {
    const isActive = document.queryCommandState(cmd);
    const button = Array.from(document.querySelectorAll(".toolbar-btn")).find(
      (btn) => btn.getAttribute("onclick")?.includes(cmd)
    );
    if (button) {
      if (isActive) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    }
  });
}

function insertCitation() {
  if (!appData.copiedCitation) {
    alert("No citation copied. Please copy a citation from the browser first.");
    return;
  }

  const editor = document.getElementById("noteContent");
  editor.focus();
  document.execCommand(
    "insertHTML",
    false,
    `<p><em>${escapeHtml(appData.copiedCitation)}</em></p>`
  );
}

function showDiagramPicker() {
  if (!appData.currentTask) return;

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task || !task.diagrams || task.diagrams.length === 0) {
    alert(
      "No diagrams saved for this task. Create and save diagrams in the Whiteboard module first."
    );
    return;
  }

  const modal = document.getElementById("diagramPickerModal");
  const gallery = document.getElementById("diagramPickerGallery");

  gallery.innerHTML = task.diagrams
    .map(
      (diagram, index) => `
    <div class="gallery-item" onclick="insertDiagram(${index})">
      <img src="${diagram.imageData}" alt="Diagram ${index + 1}">
    </div>
  `
    )
    .join("");

  modal.style.display = "flex";
}

function closeDiagramPicker() {
  document.getElementById("diagramPickerModal").style.display = "none";
}

function insertDiagram(index) {
  if (!appData.currentTask) return;

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task || !task.diagrams) return;

  const diagram = task.diagrams[index];
  const editor = document.getElementById("noteContent");
  editor.focus();

  // Create a unique ID for this diagram instance
  const diagramId = "diagram-" + Date.now();

  // Insert diagram wrapped in a resizable container
  const diagramHTML = `
    <div class="diagram-wrapper" id="${diagramId}" data-width="400" data-aspect-ratio="1">
      <img src="${
        diagram.imageData
      }" style="width: 400px; height: auto;" alt="Diagram ${index + 1}">
      <div class="resize-handle"></div>
    </div>
    <p><br></p>
  `;

  document.execCommand("insertHTML", false, diagramHTML);

  // Initialize resize functionality for the newly inserted diagram
  setTimeout(() => {
    const wrapper = document.getElementById(diagramId);
    if (wrapper) {
      makeImageResizable(wrapper);
    }
  }, 100);

  closeDiagramPicker();
}

function exportNoteTXT() {
  if (!appData.currentTask) return;

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task || !task.currentNote) {
    alert("No note to export.");
    return;
  }

  const note = task.notes.find((n) => n.id === task.currentNote);
  if (note) {
    const editor = document.getElementById("noteContent");
    const textContent = editor.innerText || editor.textContent;
    const date = new Date(note.timestamp).toISOString().split("T")[0];
    const fileName = `${note.title.replace(/[^a-z0-9]/gi, "-")}-${date}.txt`;

    const content = `${note.title}\n${"=".repeat(
      note.title.length
    )}\n\nCreated: ${new Date(
      note.timestamp
    ).toLocaleString()}\n\n${textContent}`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    showNotification("Note exported as TXT!");
  }
}

function exportNotePDF() {
  if (!appData.currentTask) return;

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task || !task.currentNote) {
    alert("No note to export.");
    return;
  }

  const note = task.notes.find((n) => n.id === task.currentNote);
  if (note) {
    const date = new Date(note.timestamp).toISOString().split("T")[0];
    const fileName = `${note.title.replace(/[^a-z0-9]/gi, "-")}-${date}.pdf`;

    // Create a printable HTML version
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${escapeHtml(note.title)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
          }
          h1 {
            color: #1d3a3b;
            border-bottom: 2px solid #21808d;
            padding-bottom: 10px;
          }
          .metadata {
            color: #666;
            font-size: 14px;
            margin-bottom: 30px;
          }
          h2 { font-size: 22px; margin-top: 24px; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(note.title)}</h1>
        <div class="metadata">Created: ${new Date(
          note.timestamp
        ).toLocaleString()}</div>
        <div>${note.content}</div>
      </body>
      </html>
    `;

    // Open print dialog with the content
    const printWindow = window.open("", "_blank");
    printWindow.document.write(printContent);
    printWindow.document.close();

    // Wait for content to load, then trigger print
    printWindow.onload = function () {
      printWindow.print();
    };

    showNotification('Print dialog opened. Use "Save as PDF" to export!');
  }
}

function showNotification(message) {
  const notification = document.createElement("div");
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: var(--color-primary);
    color: var(--color-btn-primary-text);
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    font-weight: 500;
  `;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.transition = "opacity 0.3s";
    notification.style.opacity = "0";
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===== DIAGRAM RESIZING FUNCTIONS =====
function makeImageResizable(wrapper) {
  const handle = wrapper.querySelector(".resize-handle");
  const img = wrapper.querySelector("img");

  if (!handle || !img) return;

  let isResizing = false;
  let startX, startY, startWidth, startHeight;

  // Calculate and store aspect ratio
  const aspectRatio = img.naturalHeight / img.naturalWidth;
  wrapper.setAttribute("data-aspect-ratio", aspectRatio);

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;

    startX = e.clientX;
    startY = e.clientY;
    startWidth = img.offsetWidth;
    startHeight = img.offsetHeight;

    wrapper.classList.add("selected");

    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stopResize);
  });

  function resize(e) {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;
    let newWidth = startWidth + deltaX;

    // Apply constraints
    newWidth = Math.max(50, Math.min(800, newWidth));

    // Calculate height maintaining aspect ratio
    const newHeight = newWidth * aspectRatio;

    // Apply size constraints for height
    if (newHeight < 50 || newHeight > 600) {
      return;
    }

    img.style.width = newWidth + "px";
    img.style.height = "auto";
    wrapper.setAttribute("data-width", newWidth);
  }

  function stopResize() {
    isResizing = false;
    wrapper.classList.remove("selected");
    document.removeEventListener("mousemove", resize);
    document.removeEventListener("mouseup", stopResize);
  }

  // Click wrapper to select
  wrapper.addEventListener("click", (e) => {
    if (e.target === handle) return;
    document
      .querySelectorAll(".diagram-wrapper")
      .forEach((w) => w.classList.remove("selected"));
    wrapper.classList.add("selected");
  });
}

// Initialize all existing diagrams when loading a note
function initializeResizableDiagrams() {
  const editor = document.getElementById("noteContent");
  if (!editor) return;

  const wrappers = editor.querySelectorAll(".diagram-wrapper");
  wrappers.forEach((wrapper) => {
    makeImageResizable(wrapper);
  });
}

// ===== LINK DETECTION AND LINKIFICATION =====
function linkifyText(text) {
  // Regex to detect URLs (http://, https://, www.)
  const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
  return text.replace(urlRegex, (url) => {
    let href = url;
    // Add protocol if missing
    if (url.startsWith("www.")) {
      href = "https://" + url;
    }
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

function processLinksInEditor() {
  const editor = document.getElementById("noteContent");
  if (!editor) return;

  // Get all text nodes
  const walker = document.createTreeWalker(
    editor,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    // Skip if parent is already a link
    if (node.parentElement.tagName !== "A") {
      textNodes.push(node);
    }
  }

  // Process each text node
  textNodes.forEach((textNode) => {
    const text = textNode.textContent;
    const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

    if (urlRegex.test(text)) {
      const span = document.createElement("span");
      span.innerHTML = linkifyText(text);
      textNode.parentNode.replaceChild(span, textNode);

      // Replace span with its contents
      while (span.firstChild) {
        span.parentNode.insertBefore(span.firstChild, span);
      }
      span.remove();
    }
  });
}

// Debounce function to avoid excessive processing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debouncedLinkProcess = debounce(processLinksInEditor, 1000);

// Update toolbar state on selection change
document.addEventListener("DOMContentLoaded", () => {
  const editor = document.getElementById("noteContent");
  if (editor) {
    editor.addEventListener("mouseup", updateToolbarState);
    editor.addEventListener("keyup", updateToolbarState);

    // Add link detection on input
    editor.addEventListener("input", debouncedLinkProcess);

    // Detect paste events and linkify
    editor.addEventListener("paste", (e) => {
      setTimeout(() => {
        processLinksInEditor();
      }, 100);
    });

    // Click outside diagrams to deselect
    editor.addEventListener("click", (e) => {
      if (!e.target.closest(".diagram-wrapper")) {
        document
          .querySelectorAll(".diagram-wrapper")
          .forEach((w) => w.classList.remove("selected"));
      }
    });
  }
});

// ===== TASK MANAGEMENT FUNCTIONS =====

function selectPresetTime(minutes) {
  document.getElementById("newTaskTime").value = minutes;

  // Visual feedback - highlight selected preset
  document.querySelectorAll(".btn.time-preset-active").forEach((btn) => {
    btn.classList.remove("time-preset-active");
  });
  event.target.classList.add("time-preset-active");
}

function showCreateTaskForm() {
  document.getElementById("createTaskModal").style.display = "flex";
  document.getElementById("newTaskName").value = "";
  document.getElementById("newTaskTime").value = "";

  // Remove active state from preset buttons
  document.querySelectorAll(".btn.time-preset-active").forEach((btn) => {
    btn.classList.remove("time-preset-active");
  });

  document.getElementById("newTaskName").focus();
}

function closeCreateTaskForm() {
  document.getElementById("createTaskModal").style.display = "none";
}

// ===== SERVER SYNC FUNCTIONS =====

// Load tasks from server
async function loadTasksFromServer() {
  try {
    const response = await fetch("/api/tasks", {
      credentials: "include",
    });
    const data = await response.json();

    if (data.success) {
      appData.tasks = data.tasks || [];
      renderTaskDashboard();
    } else {
      console.error("Failed to load tasks:", data.message);
    }
  } catch (error) {
    console.error("Error loading tasks from server:", error);
  }
}

// Decide where to load tasks based on auth state
function loadTasksDependingOnAuth() {
  if (authState.isLoggedIn) {
    hideAnonymousBanner();
    loadTasksFromServer();
  } else {
    // Anonymous: load from localStorage and show warning
    loadLocalTasks();
    showAnonymousBanner();
  }
}

function loadLocalTasks() {
  try {
    const raw = localStorage.getItem("focushub_tasks_v1");
    if (!raw) {
      appData.tasks = [];
      renderTaskDashboard();
      return;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      appData.tasks = parsed;
    } else {
      appData.tasks = [];
    }
    renderTaskDashboard();
  } catch (e) {
    console.error("Error loading local tasks:", e);
    appData.tasks = [];
    renderTaskDashboard();
  }
}

function saveLocalTasks() {
  try {
    localStorage.setItem("focushub_tasks_v1", JSON.stringify(appData.tasks));
  } catch (e) {
    console.error("Error saving local tasks:", e);
  }
}

function showAnonymousBanner() {
  let banner = document.getElementById("anonWarning");
  if (!banner) return;
  banner.style.display = "flex";
}

function hideAnonymousBanner() {
  let banner = document.getElementById("anonWarning");
  if (!banner) return;
  banner.style.display = "none";
}

// If user logs in and has local tasks, offer to upload them to the server
async function syncLocalToServerIfNeeded() {
  try {
    const raw = localStorage.getItem("focushub_tasks_v1");
    if (!raw) return;
    const localTasks = JSON.parse(raw);
    if (!Array.isArray(localTasks) || localTasks.length === 0) return;

    if (
      !confirm(
        `Se detectaron ${localTasks.length} tareas creadas sin registrar.\n¿Deseas subirlas a tu cuenta ahora?`
      )
    ) {
      return;
    }

    for (const lt of localTasks) {
      try {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            nombre: lt.nombre || lt.name,
            timeAllocated: lt.timeAllocated || lt.timeAllocated,
          }),
        });
      } catch (e) {
        console.error("Error uploading local task:", e);
      }
    }

    // Clear local tasks after attempting upload and reload from server
    localStorage.removeItem("focushub_tasks_v1");
    showNotification(
      "Tareas locales subidas. Recargando tareas del servidor..."
    );
    await loadTasksFromServer();
  } catch (e) {
    console.error("Error syncing local tasks:", e);
  }
}

// Create task and save to server
async function createTask() {
  const name = document.getElementById("newTaskName").value.trim();
  const timeAllocation = parseInt(document.getElementById("newTaskTime").value);

  if (!name) {
    alert("Por favor ingresa un nombre de tarea");
    return;
  }

  if (!timeAllocation || timeAllocation < 1) {
    alert("Por favor ingresa un tiempo válido (mínimo 1 minuto)");
    return;
  }

  try {
    if (authState.isLoggedIn) {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nombre: name, timeAllocated }),
      });

      const data = await response.json();

      if (data.success) {
        // Add to local appData
        const task = {
          id: data.taskId,
          nombre: name,
          timeAllocated: timeAllocation,
          timeSpent: 0,
          status: "pending",
          notes: [],
          diagrams: [],
          currentNote: null,
          created_at: new Date().toISOString(),
        };

        appData.tasks.push(task);
        closeCreateTaskForm();
        renderTaskDashboard();
        showNotification("✓ Tarea creada exitosamente!");
      } else {
        alert("Error: " + data.message);
      }
    } else {
      // Anonymous user: store locally
      const task = {
        id: Date.now(),
        nombre: name,
        timeAllocated: timeAllocation,
        timeSpent: 0,
        status: "pending",
        notes: [],
        diagrams: [],
        currentNote: null,
        created_at: new Date().toISOString(),
      };

      appData.tasks.push(task);
      saveLocalTasks();
      closeCreateTaskForm();
      renderTaskDashboard();
      showNotification(
        "✓ Tarea creada (guardada localmente). Regístrate para persistirla en la nube."
      );
    }
  } catch (error) {
    console.error("Error creating task:", error);
    alert("Error al crear la tarea");
  }
}

function renderTaskDashboard() {
  const container = document.getElementById("tasksList");
  const emptyState = document.getElementById("emptyTaskState");

  if (appData.tasks.length === 0) {
    container.style.display = "none";
    emptyState.style.display = "block";
    updateDailyGoalDisplay();
    return;
  }

  container.style.display = "flex";
  emptyState.style.display = "none";
  updateDailyGoalDisplay();

  // Sort tasks: pending first, completed last
  const sortedTasks = [...appData.tasks].sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return 1;
    if (a.status !== "completed" && b.status === "completed") return -1;
    return 0;
  });

  container.innerHTML = sortedTasks
    .map((task, index) => {
      const timeProgress =
        task.timeAllocated > 0
          ? (task.timeSpent / task.timeAllocated) * 100
          : 0;
      const timeRemaining = Math.max(0, task.timeAllocated - task.timeSpent);
      const isCompleted = task.status === "completed";

      return `
      <div class="task-item ${
        isCompleted ? "completed" : ""
      }" draggable="true" data-task-id="${
        task.id
      }" onclick="enterTaskWorkspace(${
        task.id
      })" ondragstart="handleDragStart(event)" ondragover="handleDragOver(event)" ondrop="handleDrop(event)" ondragend="handleDragEnd(event)">
        <div class="task-info">
          <div style="display: flex; align-items: center; gap: var(--space-12); margin-bottom: var(--space-8);">
            <div class="task-title ${isCompleted ? "completed" : ""}">${
        isCompleted ? "✓ " : ""
      }${escapeHtml(task.name)}</div>
            <span class="task-status-badge ${task.status}">${
        task.status === "completed"
          ? "✓ Completed"
          : task.timeSpent > 0
          ? "In Progress"
          : "Pending"
      }</span>
          </div>
          <div class="task-time-display">
            <span>⏱️ ${Math.round(task.timeSpent)}m / ${
        task.timeAllocated
      }m</span>
            ${
              !isCompleted
                ? `<span style="margin-left: auto;">Remaining: ${Math.round(
                    timeRemaining
                  )}m</span>`
                : `<span style="margin-left: auto; color: #00aa00;">Time Used: ${Math.round(
                    task.timeSpent
                  )}m</span>`
            }
          </div>
          <div class="task-time-bar">
            <div class="task-time-progress" style="width: ${Math.min(
              100,
              timeProgress
            )}%; ${isCompleted ? "background-color: #00aa00;" : ""}"></div>
          </div>
        </div>
        <div class="task-actions">
          <button class="btn ${
            isCompleted ? "btn--secondary" : "btn--primary"
          }" onclick="event.stopPropagation(); enterTaskWorkspace(${task.id})">
            ${
              isCompleted
                ? "View →"
                : task.timeSpent > 0
                ? "Resume →"
                : "Start →"
            }
          </button>
          <button class="btn btn--secondary" onclick="event.stopPropagation(); deleteTask(${
            task.id
          })" title="Delete">
            🗑️
          </button>
        </div>
      </div>
    `;
    })
    .join("");

  // Re-attach drag event listeners after render
  attachDragListeners();
}

// Drag and Drop Functions
let draggedTaskId = null;

function handleDragStart(e) {
  draggedTaskId = parseInt(e.currentTarget.getAttribute("data-task-id"));
  e.currentTarget.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";

  const taskItem = e.currentTarget;
  if (
    taskItem.classList.contains("task-item") &&
    !taskItem.classList.contains("dragging")
  ) {
    taskItem.classList.add("drag-over");
  }
  return false;
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  const dropTaskId = parseInt(e.currentTarget.getAttribute("data-task-id"));

  if (draggedTaskId !== dropTaskId) {
    // Find indices
    const draggedIndex = appData.tasks.findIndex((t) => t.id === draggedTaskId);
    const dropIndex = appData.tasks.findIndex((t) => t.id === dropTaskId);

    // Reorder array
    const [draggedTask] = appData.tasks.splice(draggedIndex, 1);
    appData.tasks.splice(dropIndex, 0, draggedTask);

    renderTaskDashboard();
  }

  // Remove drag-over class
  document.querySelectorAll(".drag-over").forEach((item) => {
    item.classList.remove("drag-over");
  });

  return false;
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove("dragging");
  document.querySelectorAll(".drag-over").forEach((item) => {
    item.classList.remove("drag-over");
  });
  draggedTaskId = null;
}

function attachDragListeners() {
  // Additional setup if needed - events are inline in HTML
}

function deleteTask(id) {
  if (
    confirm("¿Eliminar esta tarea? Se perderán todas las notas y diagramas.")
  ) {
    if (authState.isLoggedIn) {
      deleteTaskFromServer(id);
    } else {
      // Anonymous - delete locally
      appData.tasks = appData.tasks.filter((t) => t.id !== id);
      saveLocalTasks();
      renderTaskDashboard();
      showNotification("✓ Tarea eliminada (localmente)");
    }
  }
}

// Delete task from server
async function deleteTaskFromServer(taskId) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await response.json();

    if (data.success) {
      appData.tasks = appData.tasks.filter((t) => t.id !== taskId);
      renderTaskDashboard();
      showNotification("✓ Tarea eliminada");
    } else {
      alert("Error: " + data.message);
    }
  } catch (error) {
    console.error("Error deleting task:", error);
    alert("Error al eliminar la tarea");
  }
}

function enterTaskWorkspace(taskId) {
  const task = appData.tasks.find((t) => t.id === taskId);
  if (!task) return;

  appData.currentTask = taskId;
  appData.inTaskWorkspace = true;

  // Check if this is first time entering the task OR resuming
  if (
    task.timeSpent === 0 &&
    task.notes.length === 0 &&
    task.diagrams.length === 0
  ) {
    // First time - show prompt AND auto-start timer
    showTaskInitialPrompt(task);
  } else {
    // Resuming task - start directly with browser AND auto-start/resume timer
    resumeTaskWorkspace(task);
  }
}

function showTaskInitialPrompt(task) {
  // Switch to prompt view
  document
    .querySelectorAll(".module")
    .forEach((m) => m.classList.remove("active"));
  document.getElementById("taskInitialPrompt").classList.add("active");

  // Update prompt content
  document.getElementById(
    "promptTaskName"
  ).textContent = `Welcome to "${task.name}"`;
  document.getElementById(
    "promptTaskTime"
  ).textContent = `You have ${task.timeAllocated} minutes allocated for this task`;

  // Update UI
  document.getElementById("currentTaskDisplay").textContent = task.name;
  document.getElementById("dashboardSidebar").style.display = "none";
  document.getElementById("workspaceSidebar").style.display = "flex";

  // AUTO-START TIMER IMMEDIATELY when task workspace loads
  startTaskTimer(task);

  // Update timer display
  updateTopTimerDisplay();
  updateTaskTimerControls();
}

function setupTaskResource(resourceType) {
  if (!appData.currentTask) return;

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task) return;

  // Hide prompt, show resource module
  document
    .querySelectorAll(".module")
    .forEach((m) => m.classList.remove("active"));
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.remove("active"));

  if (resourceType === "notes") {
    document.getElementById("notesModule").classList.add("active");
    document
      .querySelector('.nav-btn[onclick*="notes"]')
      .classList.add("active");
    loadTaskNotes(task);
  } else if (resourceType === "whiteboard") {
    document.getElementById("whiteboardModule").classList.add("active");
    document
      .querySelector('.nav-btn[onclick*="whiteboard"]')
      .classList.add("active");
    loadTaskWhiteboard(task);
  }

  // Update UI
  document.getElementById("currentTaskDisplay").textContent = task.name;
  document.getElementById("dashboardSidebar").style.display = "none";
  document.getElementById("workspaceSidebar").style.display = "flex";

  // Hide timer panel when in task
  const timerPanel = document.getElementById("timerPanel");
  if (timerPanel) timerPanel.style.display = "none";

  // Timer already started in showTaskInitialPrompt - no need to start again

  // Update timer display
  updateTopTimerDisplay();
  updateTaskTimerControls();
}

function resumeTaskWorkspace(task) {
  // Switch to browser by default
  document
    .querySelectorAll(".module")
    .forEach((m) => m.classList.remove("active"));
  document
    .querySelectorAll("#workspaceSidebar .nav-btn")
    .forEach((b) => b.classList.remove("active"));

  document.getElementById("browserModule").classList.add("active");
  const browserBtn = document.querySelector(
    '#workspaceSidebar .nav-btn[onclick*="browser"]'
  );
  if (browserBtn) browserBtn.classList.add("active");

  initializeBrowser();

  // Update UI
  document.getElementById("currentTaskDisplay").textContent = task.name;
  document.getElementById("dashboardSidebar").style.display = "none";
  document.getElementById("workspaceSidebar").style.display = "flex";

  // Hide timer panel when in task
  const timerPanel = document.getElementById("timerPanel");
  if (timerPanel) timerPanel.style.display = "none";

  // AUTO-START/RESUME TIMER IMMEDIATELY for resumed tasks
  if (!appData.timer.isRunning) {
    startTaskTimer(task);
  }

  // Update timer display
  updateTopTimerDisplay();
  updateTaskTimerControls();
}

function startWorkingOnTask() {
  if (!appData.currentTask) return;

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task) return;

  // Switch to browser by default
  document
    .querySelectorAll(".module")
    .forEach((m) => m.classList.remove("active"));
  document
    .querySelectorAll("#workspaceSidebar .nav-btn")
    .forEach((b) => b.classList.remove("active"));

  document.getElementById("browserModule").classList.add("active");
  const browserBtn = document.querySelector(
    '#workspaceSidebar .nav-btn[onclick*="browser"]'
  );
  if (browserBtn) browserBtn.classList.add("active");

  initializeBrowser();

  // Update UI
  document.getElementById("currentTaskDisplay").textContent = task.name;
  document.getElementById("dashboardSidebar").style.display = "none";
  document.getElementById("workspaceSidebar").style.display = "flex";

  // Hide timer panel when in task
  const timerPanel = document.getElementById("timerPanel");
  if (timerPanel) timerPanel.style.display = "none";

  // Timer already started in showTaskInitialPrompt - no need to start again

  // Update timer display
  updateTopTimerDisplay();
  updateTaskTimerControls();
}

function exitTaskWorkspace() {
  if (!appData.currentTask) return;

  // Stop task timer if running
  if (appData.timer.isRunning) {
    stopTaskTimer();
  }

  // Save any unsaved work
  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (task) {
    // Auto-save current note if in notes module
    if (document.getElementById("notesModule").classList.contains("active")) {
      saveTaskNote(task);
    }
  }

  // Reset state
  appData.currentTask = null;
  appData.inTaskWorkspace = false;

  // Switch back to dashboard - HIDE BROWSER
  document
    .querySelectorAll(".module")
    .forEach((m) => m.classList.remove("active"));
  document.getElementById("taskDashboard").classList.add("active");

  // Hide browser module explicitly when returning to dashboard
  document.getElementById("browserModule").classList.remove("active");

  document.getElementById("currentTaskDisplay").textContent = "Task Dashboard";
  document.getElementById("dashboardSidebar").style.display = "flex";
  document.getElementById("workspaceSidebar").style.display = "none";

  // Update active state on dashboard sidebar
  document.querySelectorAll("#dashboardSidebar .nav-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  const tasksBtn = document.querySelector(
    '#dashboardSidebar .nav-btn[onclick*="tasks"]'
  );
  if (tasksBtn) tasksBtn.classList.add("active");

  // Update timer display to show "No Active Task"
  updateTopTimerDisplay();

  renderTaskDashboard();
}

// Daily Goal Functions
function updateDailyGoal() {
  const input = document.getElementById("dailyGoalInput");
  const value = parseInt(input.value);

  if (value && value >= 10) {
    appData.dailyGoal.targetMinutes = value;
    updateDailyGoalDisplay();
  }
}

function updateDailyGoalDisplay() {
  const progressBar = document.getElementById("goalProgressBar");
  const percentage = document.getElementById("goalPercentage");
  const timeDisplay = document.getElementById("goalTimeDisplay");
  const completionMessage = document.getElementById("goalCompletionMessage");

  if (!progressBar || !percentage || !timeDisplay) return;

  const completed = appData.dailyGoal.completedMinutes;
  const target = appData.dailyGoal.targetMinutes;
  const percentValue = Math.min(100, Math.round((completed / target) * 100));

  // Update progress bar
  progressBar.style.height = percentValue + "%";
  percentage.textContent = percentValue + "%";
  timeDisplay.textContent = `${completed} min / ${target} min`;

  // Check if goal completed
  if (completed >= target) {
    progressBar.classList.add("completed");
    completionMessage.style.display = "block";
  } else {
    progressBar.classList.remove("completed");
    completionMessage.style.display = "none";
  }
}

// ===== WHITEBOARD FUNCTIONS =====
function initializeWhiteboard() {
  canvas = document.getElementById("whiteboard");
  ctx = canvas.getContext("2d");

  canvas.addEventListener("mousedown", canvasMouseDown);
  canvas.addEventListener("mousemove", canvasMouseMove);
  canvas.addEventListener("mouseup", canvasMouseUp);
  canvas.addEventListener("mouseout", canvasMouseUp);

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function startDrawing(e) {
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  startX = (e.clientX - rect.left) * scaleX;
  startY = (e.clientY - rect.top) * scaleY;

  if (currentTool === "pencil" || currentTool === "eraser") {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
  } else if (
    currentTool === "rectangle" ||
    currentTool === "circle" ||
    currentTool === "line" ||
    currentTool === "arrow"
  ) {
    // For shape preview, we'll use canvasSnapshot (drawing only)
    // This way we avoid restoring old image positions
    // savedImageData is no longer used for shape preview
  }
}

function draw(e) {
  if (!isDrawing) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  ctx.lineWidth = currentSize;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (currentTool === "pencil") {
    ctx.strokeStyle = currentColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  } else if (currentTool === "eraser") {
    ctx.strokeStyle = "white";
    ctx.lineWidth = currentSize * 3;
    ctx.lineTo(x, y);
    ctx.stroke();
  } else if (
    currentTool === "rectangle" ||
    currentTool === "circle" ||
    currentTool === "line" ||
    currentTool === "arrow"
  ) {
    // For shape preview: restore drawing snapshot and redraw images on top
    if (canvasSnapshot) {
      ctx.putImageData(canvasSnapshot, 0, 0);
    } else {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Redraw all images
    for (let imgObj of canvasImages) {
      if (imgObj.img && imgObj.img.complete) {
        ctx.drawImage(imgObj.img, imgObj.x, imgObj.y, imgObj.width, imgObj.height);
      }
    }

    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;

    if (currentTool === "rectangle") {
      ctx.strokeRect(startX, startY, x - startX, y - startY);
    } else if (currentTool === "circle") {
      const radius = Math.sqrt(
        Math.pow(x - startX, 2) + Math.pow(y - startY, 2)
      );
      ctx.beginPath();
      ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (currentTool === "line") {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (currentTool === "arrow") {
      drawArrow(startX, startY, x, y);
    }
  }
}

function stopDrawing(e) {
  if (!isDrawing) return;
  isDrawing = false;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  if (currentTool === "text") {
    const text = prompt("Enter text:");
    if (text) {
      ctx.fillStyle = currentColor;
      ctx.font = `${currentSize * 10}px Arial`;
      ctx.fillText(text, startX, startY);
    }
  }

  // After any drawing (including shapes), update the snapshot
  // Get the current canvas (drawing + images)
  const currentCanvas = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Create snapshot with only the drawing (white out image areas)
  const drawingOnly = ctx.createImageData(canvas.width, canvas.height);
  const drawingData = drawingOnly.data;
  const currentData = currentCanvas.data;
  
  // Start with a copy of current canvas
  for (let i = 0; i < currentData.length; i++) {
    drawingData[i] = currentData[i];
  }
  
  // Replace image areas with white
  for (let imgObj of canvasImages) {
    const x1 = Math.max(0, Math.floor(imgObj.x));
    const y1 = Math.max(0, Math.floor(imgObj.y));
    const x2 = Math.min(canvas.width, Math.ceil(imgObj.x + imgObj.width));
    const y2 = Math.min(canvas.height, Math.ceil(imgObj.y + imgObj.height));
    
    for (let py = y1; py < y2; py++) {
      for (let px = x1; px < x2; px++) {
        const idx = (py * canvas.width + px) * 4;
        drawingData[idx] = 255;     // R - white
        drawingData[idx + 1] = 255; // G - white
        drawingData[idx + 2] = 255; // B - white
        drawingData[idx + 3] = 255; // A - opaque
      }
    }
  }
  
  canvasSnapshot = drawingOnly;
  savedImageData = null;
}

function drawArrow(fromX, fromY, toX, toY) {
  const headLength = 20;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

function selectToolByName(toolName) {
  currentTool = toolName;

  // Update UI - remove active class from all tool buttons
  document.querySelectorAll(".tool-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Add active class to selected tool
  const selectedBtn = document.querySelector(
    `.tool-btn[data-tool="${toolName}"]`
  );
  if (selectedBtn) {
    selectedBtn.classList.add("active");
  }
}

function selectColor(color) {
  currentColor = color;

  // Update UI - remove active class from all color buttons
  document.querySelectorAll(".color-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Add active class to selected color
  const selectedBtn = document.querySelector(
    `.color-btn[data-color="${color}"]`
  );
  if (selectedBtn) {
    selectedBtn.classList.add("active");
  }
}

function clearCanvas() {
  if (confirm("Clear the entire canvas?")) {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function saveDiagram() {
  if (!appData.currentTask) {
    alert("No active task. Diagrams are task-specific.");
    return;
  }

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task) return;

  const imageData = canvas.toDataURL("image/png");
  
  // Save images data separately (store src URLs from canvas images)
  const savedImages = canvasImages.map(img => ({
    id: img.id,
    src: img.src,
    x: img.x,
    y: img.y,
    width: img.width,
    height: img.height
  }));

  const diagram = {
    id: Date.now(),
    imageData,
    images: savedImages,
    timestamp: new Date().toISOString(),
  };

  if (!task.diagrams) task.diagrams = [];
  task.diagrams.push(diagram);
  loadTaskWhiteboard(task);
  showNotification("Diagram saved to this task!");
}

function loadTaskWhiteboard(task) {
  renderDiagramGallery();
}

function exportCanvas() {
  const imageData = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = imageData;
  a.download = `diagram-${Date.now()}.png`;
  a.click();
}

function renderDiagramGallery() {
  if (!appData.currentTask) return;

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  const gallery = document.getElementById("diagramGallery");

  if (!task || !task.diagrams || task.diagrams.length === 0) {
    gallery.innerHTML =
      '<p style="color: var(--color-text-secondary); font-size: var(--font-size-sm); text-align: center; padding: var(--space-16);">No saved diagrams for this task yet. Draw something and click Save!</p>';
    return;
  }

  gallery.innerHTML = task.diagrams
    .map(
      (diagram, index) => `
    <div class="gallery-item" onclick="loadDiagram(${index})">
      <img src="${diagram.imageData}" alt="Diagram ${index + 1}">
      <div class="gallery-item-actions">
        <button onclick="event.stopPropagation(); downloadDiagram(${index})" title="Download">⬇️</button>
        <button onclick="event.stopPropagation(); deleteDiagram(${index})" title="Delete">🗑️</button>
      </div>
    </div>
  `
    )
    .join("");
}

function loadDiagram(index) {
  if (!appData.currentTask) return;

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task || !task.diagrams) return;

  const diagram = task.diagrams[index];
  const img = new Image();
  img.onload = function () {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Restore images if they exist
    if (diagram.images && diagram.images.length > 0) {
      canvasImages = [];
      let imagesLoaded = 0;
      const totalImages = diagram.images.length;

      diagram.images.forEach(savedImg => {
        const imgObj = {
          id: savedImg.id,
          src: savedImg.src,
          x: savedImg.x,
          y: savedImg.y,
          width: savedImg.width,
          height: savedImg.height,
          img: null
        };

        const loadedImg = new Image();
        loadedImg.onload = () => {
          imgObj.img = loadedImg;
          imagesLoaded++;
          if (imagesLoaded === totalImages) {
            redrawCanvas();
          }
        };
        loadedImg.src = savedImg.src;
        canvasImages.push(imgObj);
      });
    }
  };
  img.src = diagram.imageData;
  selectedImage = null;
  showNotification("Diagram loaded into canvas!");
}

function downloadDiagram(index) {
  if (!appData.currentTask) return;

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task || !task.diagrams) return;

  const diagram = task.diagrams[index];
  const a = document.createElement("a");
  a.href = diagram.imageData;
  a.download = `diagram-${index + 1}-${Date.now()}.png`;
  a.click();
  showNotification("Diagram downloaded!");
}

function deleteDiagram(index) {
  if (!appData.currentTask) return;

  const task = appData.tasks.find((t) => t.id === appData.currentTask);
  if (!task || !task.diagrams) return;

  if (confirm("Delete this diagram?")) {
    task.diagrams.splice(index, 1);
    renderDiagramGallery();
    showNotification("Diagram deleted");
  }
}

// ===== MUSIC PLAYER FUNCTIONS =====
function playPlaylist(type) {
  if (!playlists[type]) return;

  currentPlaylistType = type;
  let embedUrl = playlists[type];

  // Add autoplay=0 initially (user will click play button to start)
  if (!embedUrl.includes("autoplay")) {
    embedUrl += (embedUrl.includes("?") ? "&" : "?") + "autoplay=0";
  } else {
    embedUrl = embedUrl.replace("autoplay=1", "autoplay=0");
  }

  // Hide placeholder and show player
  document.getElementById("playerPlaceholder").style.display = "none";
  document.getElementById("musicPlayerContainer").style.display = "block";

  // Load the embed URL
  const iframe = document.getElementById("musicPlayerFrame");
  iframe.src = embedUrl;

  // Reset play state
  isMusicPlaying = false;
  updatePlayPauseButton();

  // Highlight active playlist
  document.querySelectorAll(".playlist-item").forEach((item) => {
    item.style.backgroundColor = "";
    item.style.border = "";
  });
  event.target.closest(".playlist-item").style.backgroundColor =
    "var(--color-secondary)";
  event.target.closest(".playlist-item").style.border =
    "2px solid var(--color-primary)";
}

function toggleMusicPlayback() {
  const iframe = document.getElementById("musicPlayerFrame");

  if (!iframe.src || iframe.src === "") {
    alert("Please select a playlist first");
    return;
  }

  // Get current source
  let currentSrc = iframe.src;

  if (!isMusicPlaying) {
    // PLAY: Change autoplay=0 to autoplay=1 and reload iframe
    if (currentSrc.includes("autoplay=0")) {
      currentSrc = currentSrc.replace("autoplay=0", "autoplay=1");
    } else if (!currentSrc.includes("autoplay")) {
      currentSrc += (currentSrc.includes("?") ? "&" : "?") + "autoplay=1";
    }
    iframe.src = currentSrc;
    isMusicPlaying = true;
  } else {
    // PAUSE: Change autoplay=1 to autoplay=0 and reload iframe
    if (currentSrc.includes("autoplay=1")) {
      currentSrc = currentSrc.replace("autoplay=1", "autoplay=0");
    }
    iframe.src = currentSrc;
    isMusicPlaying = false;
  }

  updatePlayPauseButton();
}

function updatePlayPauseButton() {
  const btn = document.getElementById("musicPlayPauseBtn");
  if (btn) {
    if (isMusicPlaying) {
      btn.innerHTML = "⏸ PAUSE MUSIC";
      btn.classList.remove("btn--primary");
      btn.classList.add("btn--secondary");
    } else {
      btn.innerHTML = "▶ PLAY MUSIC";
      btn.classList.remove("btn--secondary");
      btn.classList.add("btn--primary");
    }
  }
}

// ===== PDF IMPORT FUNCTIONS =====
async function handlePdfImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.type !== 'application/pdf') {
    showNotification('❌ Please select a valid PDF file');
    return;
  }

  if (!appData.currentTask) {
    showNotification('❌ Please select a task first');
    return;
  }

  try {
    showNotification('📄 Extracting PDF content...');
    const text = await extractPdfText(file);
    
    if (text.trim().length === 0) {
      showNotification('⚠️ PDF appears to be empty or unreadable');
      return;
    }

    // Get filename without extension
    const fileName = file.name.replace(/\.pdf$/i, '');
    
    // Create a new note with the PDF content
    const task = appData.tasks.find(t => t.id === appData.currentTask);
    if (!task) return;

    if (!task.notes) task.notes = [];
    
    const newNote = {
      id: Date.now(),
      title: fileName,
      content: text,
      createdAt: new Date().toLocaleString()
    };

    task.notes.push(newNote);
    
    // Load the new note
    loadTaskNote(appData.currentTask, newNote.id);
    
    // Refresh notes list
    loadTaskNotes(task);
    
    showNotification(`✅ PDF imported as "${fileName}"`);
  } catch (error) {
    console.error('PDF import error:', error);
    showNotification('❌ Failed to import PDF: ' + error.message);
  }

  // Reset file input
  document.getElementById('pdfFileInput').value = '';
}

async function extractPdfText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const pdf = await pdfjsLib.getDocument({ data: e.target.result }).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageStructure = buildPageStructure(textContent.items);
          
          // Add page break between pages (except for the first page)
          if (i > 1) {
            fullText += '\n---\n'; // Page separator
          }
          
          fullText += pageStructure;
        }
        
        resolve(fullText);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

// Helper function to build page structure with proper formatting
function buildPageStructure(items) {
  if (!items || items.length === 0) return '';
  
  let pageText = '';
  let currentLine = '';
  let lastY = null;
  let lastX = null;
  const LINE_HEIGHT_THRESHOLD = 5; // Threshold for detecting new lines
  const SPACE_WIDTH = 5; // Threshold for detecting spaces between words
  
  // Sort items by Y position (top to bottom), then X position (left to right)
  const sortedItems = items.sort((a, b) => {
    const yDiff = Math.abs(b.y - a.y);
    if (yDiff > LINE_HEIGHT_THRESHOLD) {
      return b.y - a.y; // Different Y = new line
    }
    return a.x - b.x; // Same line, sort by X
  });
  
  for (let item of sortedItems) {
    const text = item.str.trim();
    
    if (!text) continue; // Skip empty items
    
    // Check if we need to start a new line
    if (lastY !== null && Math.abs(item.y - lastY) > LINE_HEIGHT_THRESHOLD) {
      // New line detected
      if (currentLine.trim()) {
        pageText += currentLine.trim() + '\n';
      }
      currentLine = text;
      lastX = item.x + (item.width || 0);
    } else if (lastX !== null && item.x - lastX > SPACE_WIDTH) {
      // Space detected between words on same line
      currentLine += ' ' + text;
      lastX = item.x + (item.width || 0);
    } else {
      // Continue on same line
      currentLine += text;
      lastX = item.x + (item.width || 0);
    }
    
    lastY = item.y;
  }
  
  // Add any remaining text
  if (currentLine.trim()) {
    pageText += currentLine.trim() + '\n';
  }
  
  // Clean up multiple consecutive line breaks (convert to paragraph breaks)
  pageText = pageText.replace(/\n\n+/g, '\n\n');
  
  return pageText + '\n\n';
}

// ===== IMAGE IMPORT AND MANIPULATION FUNCTIONS =====
async function handlePngImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showNotification('❌ Please select a valid image file (PNG, JPG, or WebP)');
    return;
  }

  try {
    showNotification('📥 Loading image...');
    const imageData = await readImageFile(file);
    
    // Create image object with default size
    const newImage = {
      id: Date.now(),
      src: imageData,
      x: 50,
      y: 50,
      width: 200,
      height: 150,
      img: null // Will store the loaded Image object
    };

    // Load the image
    const img = new Image();
    img.onload = () => {
      newImage.img = img;
      // Maintain aspect ratio
      const aspectRatio = img.width / img.height;
      newImage.height = 150;
      newImage.width = 150 * aspectRatio;
      
      canvasImages.push(newImage);
      redrawCanvas();
      showNotification(`✅ Image imported (${Math.round(newImage.width)}x${Math.round(newImage.height)})`);
    };
    img.onerror = () => {
      showNotification('❌ Failed to load image');
    };
    img.src = imageData;
  } catch (error) {
    console.error('Image import error:', error);
    showNotification('❌ Failed to import image: ' + error.message);
  }

  // Reset file input
  document.getElementById('pngFileInput').value = '';
}

async function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      resolve(e.target.result);
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read image file'));
    };
    
    reader.readAsDataURL(file);
  });
}

// Enhanced canvas drawing to include images
function redrawCanvas() {
  // Restore the canvas snapshot (drawing content) if it exists
  if (canvasSnapshot) {
    ctx.putImageData(canvasSnapshot, 0, 0);
  } else {
    // If no snapshot, clear to white (initial state)
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Draw all images on top
  for (let imgObj of canvasImages) {
    if (imgObj.img && imgObj.img.complete) {
      ctx.drawImage(imgObj.img, imgObj.x, imgObj.y, imgObj.width, imgObj.height);
      
      // Draw selection border if selected
      if (selectedImage && selectedImage.id === imgObj.id) {
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 2;
        ctx.strokeRect(imgObj.x, imgObj.y, imgObj.width, imgObj.height);
        
        // Draw resize handle
        const handleSize = 12;
        ctx.fillStyle = '#2196F3';
        ctx.fillRect(
          imgObj.x + imgObj.width - handleSize,
          imgObj.y + imgObj.height - handleSize,
          handleSize,
          handleSize
        );
      }
    }
  }
}

// Detect if click is on an image
function getImageAtPoint(x, y) {
  // Check from top to bottom (last drawn = last in array)
  for (let i = canvasImages.length - 1; i >= 0; i--) {
    const img = canvasImages[i];
    if (x >= img.x && x <= img.x + img.width && 
        y >= img.y && y <= img.y + img.height) {
      return img;
    }
  }
  return null;
}

// Check if clicking on resize handle
function isOnResizeHandle(imgObj, x, y) {
  if (!imgObj) return false;
  const handleSize = 12;
  const handleX = imgObj.x + imgObj.width - handleSize;
  const handleY = imgObj.y + imgObj.height - handleSize;
  return x >= handleX && x <= handleX + handleSize &&
         y >= handleY && y <= handleY + handleSize;
}

// Modified canvas mouse down to handle images
function canvasMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);

  // Check if clicking on an image
  const clickedImage = getImageAtPoint(x, y);
  
  if (clickedImage) {
    // Don't save snapshot when dragging images - just clear drawing while dragging
    // The snapshot will be updated when drawing finishes (in canvasMouseUp)
    
    selectedImage = clickedImage;
    
    // Check if clicking on resize handle
    if (isOnResizeHandle(clickedImage, x, y)) {
      isResizingImage = true;
    } else {
      isDraggingImage = true;
      dragOffsetX = x - clickedImage.x;
      dragOffsetY = y - clickedImage.y;
    }
    redrawCanvas();
    return;
  }

  // If not clicking on image, start drawing
  selectedImage = null;
  isDraggingImage = false;
  isResizingImage = false;
  
  if (currentTool === 'pencil' || currentTool === 'eraser' || currentTool === 'text') {
    isDrawing = true;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    startX = (e.clientX - rect.left) * scaleX;
    startY = (e.clientY - rect.top) * scaleY;

    if (currentTool === 'pencil' || currentTool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
    }
  } else if (
    currentTool === 'rectangle' ||
    currentTool === 'circle' ||
    currentTool === 'line' ||
    currentTool === 'arrow'
  ) {
    // For shapes, start drawing
    isDrawing = true;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    startX = (e.clientX - rect.left) * scaleX;
    startY = (e.clientY - rect.top) * scaleY;
  }
}

// Modified canvas mouse move to handle image dragging/resizing
function canvasMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);

  if (isDraggingImage && selectedImage) {
    selectedImage.x = x - dragOffsetX;
    selectedImage.y = y - dragOffsetY;
    redrawCanvas();
    return;
  }

  if (isResizingImage && selectedImage) {
    const newWidth = Math.max(50, x - selectedImage.x);
    const newHeight = Math.max(50, y - selectedImage.y);
    selectedImage.width = newWidth;
    selectedImage.height = newHeight;
    redrawCanvas();
    return;
  }

  // Normal drawing
  if (!isDrawing) return;

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const drawX = (e.clientX - rect.left) * scaleX;
  const drawY = (e.clientY - rect.top) * scaleY;

  // Restore snapshot and redraw images to ensure they stay on top
  if (canvasImages.length > 0) {
    if (canvasSnapshot) {
      ctx.putImageData(canvasSnapshot, 0, 0);
    }
    // Redraw all images
    for (let imgObj of canvasImages) {
      if (imgObj.img && imgObj.img.complete) {
        ctx.drawImage(imgObj.img, imgObj.x, imgObj.y, imgObj.width, imgObj.height);
      }
    }
  }

  ctx.lineWidth = currentSize;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (currentTool === 'pencil') {
    ctx.strokeStyle = currentColor;
    ctx.lineTo(drawX, drawY);
    ctx.stroke();
  } else if (currentTool === 'eraser') {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = currentSize * 3;
    ctx.lineTo(drawX, drawY);
    ctx.stroke();
  } else if (
    currentTool === 'rectangle' ||
    currentTool === 'circle' ||
    currentTool === 'line' ||
    currentTool === 'arrow'
  ) {
    // For shape preview: restore drawing snapshot and redraw images on top
    if (canvasSnapshot) {
      ctx.putImageData(canvasSnapshot, 0, 0);
    } else {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Redraw all images
    for (let imgObj of canvasImages) {
      if (imgObj.img && imgObj.img.complete) {
        ctx.drawImage(imgObj.img, imgObj.x, imgObj.y, imgObj.width, imgObj.height);
      }
    }

    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;

    if (currentTool === 'rectangle') {
      ctx.strokeRect(startX, startY, drawX - startX, drawY - startY);
    } else if (currentTool === 'circle') {
      const radius = Math.sqrt(
        Math.pow(drawX - startX, 2) + Math.pow(drawY - startY, 2)
      );
      ctx.beginPath();
      ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (currentTool === 'line') {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(drawX, drawY);
      ctx.stroke();
    } else if (currentTool === 'arrow') {
      drawArrow(startX, startY, drawX, drawY);
    }
  }
}

// Modified canvas mouse up to handle image operations
function canvasMouseUp(e) {
  if (isDraggingImage || isResizingImage) {
    isDraggingImage = false;
    isResizingImage = false;
    redrawCanvas();
    return;
  }

  // After drawing finishes, save ONLY the drawing part (not images)
  if (isDrawing) {
    isDrawing = false;
    
    // Handle text tool
    if (currentTool === 'text') {
      const text = prompt("Enter text:");
      if (text) {
        ctx.fillStyle = currentColor;
        ctx.font = `${currentSize * 10}px Arial`;
        ctx.fillText(text, startX, startY);
      }
    }
    
    // Capture what's currently on canvas
    const currentCanvas = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // If there are images on canvas, we need to remove them from the snapshot
    // by creating a new image data with those areas white
    if (canvasImages.length > 0) {
      const drawingOnly = ctx.createImageData(canvas.width, canvas.height);
      const drawingData = drawingOnly.data;
      const currentData = currentCanvas.data;
      
      // Start with a copy of current canvas
      for (let i = 0; i < currentData.length; i++) {
        drawingData[i] = currentData[i];
      }
      
      // Replace image areas with white
      for (let imgObj of canvasImages) {
        const x1 = Math.max(0, Math.floor(imgObj.x));
        const y1 = Math.max(0, Math.floor(imgObj.y));
        const x2 = Math.min(canvas.width, Math.ceil(imgObj.x + imgObj.width));
        const y2 = Math.min(canvas.height, Math.ceil(imgObj.y + imgObj.height));
        
        for (let py = y1; py < y2; py++) {
          for (let px = x1; px < x2; px++) {
            const idx = (py * canvas.width + px) * 4;
            drawingData[idx] = 255;     // R - white
            drawingData[idx + 1] = 255; // G - white
            drawingData[idx + 2] = 255; // B - white
            drawingData[idx + 3] = 255; // A - opaque
          }
        }
      }
      
      canvasSnapshot = drawingOnly;
    } else {
      // No images, just save the drawing as-is
      canvasSnapshot = currentCanvas;
    }
    
    // Redraw to show final result with images on top
    redrawCanvas();
  }
}

// Delete selected image
function deleteSelectedImage() {
  if (selectedImage) {
    canvasImages = canvasImages.filter(img => img.id !== selectedImage.id);
    selectedImage = null;
    redrawCanvas();
    showNotification('🗑️ Image deleted');
  }
}

// Update drawing functions to preserve images
function clearCanvas() {
  if (confirm('Clear the entire canvas? Images will also be cleared.')) {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    canvasImages = [];
    selectedImage = null;
    canvasSnapshot = null;
  }
}
