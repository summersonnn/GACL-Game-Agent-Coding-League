/**
 * Game Agent Coding League - Main Application Logic
 * Handles TXT parsing, chart rendering, and run selection
 */

let gameCharts = {};
let currentData = null;
let currentRunFile = null;
let gameConfig = null;
let leaderboardData = null;

/**
 * Clean model name by removing fp8 variants and agent suffixes
 */
function cleanModelName(modelName) {
    return modelName
        .replace(/-fp8-speedy/g, '')
        .replace(/-fp8/g, '')
        .replace(/:1$|:2$/, '');
}

/**
 * Initialize the application
 */
async function init() {
    try {
        initTabs();
        initHomeNav();
        await loadAllPrompts();

        gameConfig = await loadConfig();
        // Weights are now handled in pre-processing script
        const manifest = await loadManifest();
        populateRunSelector(manifest.runs);

        if (manifest.runs.length > 0) {
            await loadRun(manifest.runs[0]);
        }
    } catch (error) {
        console.error('Failed to initialize:', error);
        showError('Failed to load game data. Please check the console for details.');
    }
}

/**
 * Load game configuration
 */
async function loadConfig() {
    const response = await fetch(`data/config.json?t=${new Date().getTime()}`);
    if (!response.ok) {
        throw new Error(`Failed to load config: ${response.status}`);
    }
    return response.json();
}

/**
 * Load the runs manifest
 */
async function loadManifest() {
    const response = await fetch(`data/runs.json?t=${new Date().getTime()}`);
    if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.status}`);
    }
    return response.json();
}

/**
 * Populate the run selector list in the sidebar
 */
function populateRunSelector(runs) {
    const listContainer = document.getElementById('run-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    runs.forEach((run, index) => {
        const item = document.createElement('div');
        item.className = 'run-item px-3 py-2 cursor-pointer hover:bg-gray-100 rounded transition-colors';
        item.dataset.index = index;

        const displayTitle = run.name || 'Game Run';
        const dateDisplay = run.date || '';

        item.innerHTML = `
            <div class="run-name truncate font-medium text-gray-700">${displayTitle}</div>
            ${dateDisplay ? `<div class="run-date truncate text-xs text-gray-400">${dateDisplay}</div>` : ''}
        `;

        item.onclick = async () => {
            document.querySelectorAll('.run-item').forEach(el => el.classList.remove('bg-gray-100'));
            item.classList.add('bg-gray-100');

            const btnHome = document.getElementById('nav-home');
            if (btnHome) btnHome.classList.remove('bg-gray-100', 'text-gray-900');

            updateHeaderTitle(displayTitle);
            await loadRun(runs[index]);

            const pageResults = document.getElementById('page-results');
            const pageHome = document.getElementById('page-home');

            if (pageResults && pageHome) {
                pageResults.classList.remove('hidden');
                pageHome.classList.add('hidden');
            }
        };

        if (index === 0) {
            item.classList.add('bg-gray-100');
        }

        listContainer.appendChild(item);
    });
}

/**
 * Navigate to Home page
 */
function navigateToHome() {
    const btnHome = document.getElementById('nav-home');
    document.querySelectorAll('.run-item').forEach(el => el.classList.remove('bg-gray-100'));
    if (btnHome) btnHome.classList.add('bg-gray-100', 'text-gray-900');

    const pageHome = document.getElementById('page-home');
    const pageResults = document.getElementById('page-results');

    if (pageHome) pageHome.classList.remove('hidden');
    if (pageResults) pageResults.classList.add('hidden');
}

/**
 * Initialize Home navigation
 */
function initHomeNav() {
    const btnHome = document.getElementById('nav-home');
    if (!btnHome) return;

    btnHome.onclick = navigateToHome;
}

/**
 * Initialize tab navigation
 */
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            tabContents.forEach(content => {
                if (content.id === `tab-${targetTab}`) {
                    content.classList.remove('hidden');
                    content.classList.add('active');
                } else {
                    content.classList.add('hidden');
                    content.classList.remove('active');
                }
            });

            if (currentData && gameCharts[targetTab]) {
                gameCharts[targetTab].resize();
            }
        });
    });
}

/**
 * Update the header title with current run
 */
function updateHeaderTitle(title) {
    const titleEl = document.getElementById('current-run-title');
    if (titleEl) titleEl.textContent = title;
}

/**
 * Load and parse a game run
 */
async function loadRun(run) {
    try {
        currentRunFile = run.name;

        const gameData = {};

        for (const game of gameConfig.games) {
            const filename = run.files[game.id];
            if (!filename) continue;

            const response = await fetch(`data/runs/${filename}?t=${new Date().getTime()}`);
            if (!response.ok) {
                console.warn(`Failed to load ${game.id}: ${response.status}`);
                continue;
            }

            const text = await response.text();
            gameData[game.id] = parseTXT(text);
        }

        currentData = gameData;

        updateHeaderTitle(run.name || 'Game Run');
        const dateEl = document.getElementById('run-date');
        if (dateEl) dateEl.textContent = `Date: ${run.date}`;

        await loadLeaderboards();
        renderAllCharts(gameData);
        renderAllLeaderboards();
    } catch (error) {
        console.error('Failed to load run:', error);
        showError(`Failed to load game run: ${run.name}`);
    }
}

/**
 * Parse TXT file format: "Model Name - Points"
 */
function parseTXT(text) {
    const lines = text.trim().split('\n');
    const results = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const match = trimmed.match(/^(.+?)\s*-\s*(\d+(?:\.\d+)?)$/);
        if (match) {
            results.push({
                model: match[1].trim(),
                points: parseFloat(match[2])
            });
        }
    }

    return results;
}

/**
 * Render all charts (Overall + individual games)
 */
function renderAllCharts(gameData) {
    renderOverallChart(gameData);

    gameConfig.games.forEach(game => {
        renderGameChart(game.id, game.name, gameData[game.id] || []);
    });
}

/**
 * Render overall weighted chart
 */
function renderOverallChart(gameData) {
    if (!leaderboardData || !leaderboardData.overall) {
        console.warn('No overall score data available');
        return;
    }

    const overallScores = leaderboardData.overall;
    // Limit to top 20 or similar if needed, or show all. Python sorts by overall_score descending.

    // Safety check for empty data
    if (overallScores.length === 0) return;

    const labels = overallScores.map(entry => entry.model);
    const scores = overallScores.map(entry => entry.overall_score);

    renderChart('chart-overall', 'Overall Score', labels, scores);
}

/**
 * Render individual game chart
 */
function renderGameChart(gameId, gameName, data) {
    if (!leaderboardData || !leaderboardData.games || !leaderboardData.games[gameId]) {
        console.warn(`No leaderboard data for ${gameId}`);
        return;
    }

    const sorted = leaderboardData.games[gameId];

    const labels = sorted.map(entry => entry.model);
    const scores = sorted.map(entry => entry.normalized);

    renderChart(`chart-${gameId}`, gameName, labels, scores);
}

/**
 * Generic chart rendering function
 */
function renderChart(canvasId, label, labels, scores) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (gameCharts[canvasId.replace('chart-', '')]) {
        gameCharts[canvasId.replace('chart-', '')].destroy();
    }

    const colors = generateBarColors(scores.length);

    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Points',
                data: scores,
                backgroundColor: colors,
                borderColor: colors.map(c => adjustColorBrightness(c, -20)),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `Score: ${context.raw.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f3f4f6'
                    },
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });

    gameCharts[canvasId.replace('chart-', '')] = chart;
}

/**
 * Generate gradient colors for bar chart
 */
function generateBarColors(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
        const progress = i / Math.max(count - 1, 1);
        const hue = 160 - (progress * 120);
        const saturation = 25 - (progress * 10);
        const lightness = 45 + (progress * 20);
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    return colors;
}

/**
 * Adjust color brightness
 */
function adjustColorBrightness(color, amount) {
    const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
        const h = parseInt(match[1]);
        const s = parseInt(match[2]);
        const l = Math.max(0, Math.min(100, parseInt(match[3]) + amount));
        return `hsl(${h}, ${s}%, ${l}%)`;
    }
    return color;
}

/**
 * Show error message to user
 */
function showError(message) {
    const main = document.querySelector('main');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4';
    errorDiv.textContent = message;
    main.insertBefore(errorDiv, main.firstChild);
}

/**
 * Load leaderboard files for all games
 */
async function loadLeaderboards() {
    try {
        const response = await fetch(`data/leaderboard.json?t=${new Date().getTime()}`);
        if (!response.ok) {
            console.warn(`Failed to load leaderboard.json: ${response.status}`);
            leaderboardData = { games: {}, overall: [] };
            return;
        }
        leaderboardData = await response.json();
    } catch (error) {
        console.error('Error loading leaderboard JSON:', error);
        leaderboardData = { games: {}, overall: [] };
    }
}

/**
 * Render all leaderboards
 */
function renderAllLeaderboards() {
    if (!leaderboardData) return;

    renderOverallLeaderboard();

    gameConfig.games.forEach(game => {
        renderLeaderboard(game.id);
    });
}

/**
 * Render overall leaderboard table
 */
function renderOverallLeaderboard() {
    const container = document.getElementById('leaderboard-overall');
    if (!container) return;

    if (!leaderboardData.overall || leaderboardData.overall.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No leaderboard data available</p>';
        return;
    }

    const overallScores = leaderboardData.overall;

    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200';

    const thead = document.createElement('thead');
    thead.className = 'bg-gray-50';
    thead.innerHTML = `
        <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Overall Score</th>
        </tr>
    `;

    const tbody = document.createElement('tbody');
    tbody.className = 'bg-white divide-y divide-gray-200';

    overallScores.forEach((entry, index) => {
        const row = document.createElement('tr');
        row.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';

        row.innerHTML = `
            <td class="px-4 py-3 text-sm text-gray-900">${index + 1}</td>
            <td class="px-4 py-3 text-sm font-medium text-gray-900">${entry.model}</td>
            <td class="px-4 py-3 text-sm font-semibold text-gray-900 text-right">${entry.overall_score.toFixed(2)}</td>
        `;

        tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
}

/**
 * Render individual leaderboard table
 */
function renderLeaderboard(gameId) {
    const container = document.getElementById(`leaderboard-${gameId}`);
    if (!container || !leaderboardData.games || !leaderboardData.games[gameId]) return;

    const sorted = leaderboardData.games[gameId];

    if (sorted.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No leaderboard data available</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200';

    const thead = document.createElement('thead');
    thead.className = 'bg-gray-50';
    thead.innerHTML = `
        <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Games</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Wins</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Losses</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Draws</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Normalized<br>Points</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
        </tr>
    `;

    const tbody = document.createElement('tbody');
    tbody.className = 'bg-white divide-y divide-gray-200';

    sorted.forEach((entry, index) => {
        const row = document.createElement('tr');
        row.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';

        const modelName = entry.model; // Already cleaned in JSON

        row.innerHTML = `
            <td class="px-4 py-3 text-sm text-gray-900">${index + 1}</td>
            <td class="px-4 py-3 text-sm font-medium text-gray-900">${modelName}</td>
            <td class="px-4 py-3 text-sm text-gray-600 text-right">${entry.games}</td>
            <td class="px-4 py-3 text-sm text-gray-600 text-right">${entry.wins}</td>
            <td class="px-4 py-3 text-sm text-gray-600 text-right">${entry.losses}</td>
            <td class="px-4 py-3 text-sm text-gray-600 text-right">${entry.draws}</td>
            <td class="px-4 py-3 text-sm text-gray-600 text-right">${entry.points}</td>
            <td class="px-4 py-3 text-sm font-medium text-indigo-600 text-right">${entry.normalized.toFixed(2)}</td>
            <td class="px-4 py-3 text-sm font-semibold text-gray-900 text-right">${entry.score.toFixed(1)}</td>
        `;

        tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
}

/**
 * Load all game prompts on page load
 */
async function loadAllPrompts() {
    const promptFiles = ['battleship', 'tictactoe', 'wordfinder', 'connect4', 'surround_morris'];

    for (const promptName of promptFiles) {
        try {
            const response = await fetch(`data/full_prompts/${promptName}.txt?t=${new Date().getTime()}`);
            if (response.ok) {
                const text = await response.text();
                const details = document.querySelector(`details[data-prompt="${promptName}"]`);
                if (details) {
                    const contentDiv = details.querySelector('.prompt-content');
                    if (contentDiv) {
                        contentDiv.textContent = text;
                    }
                }
            } else {
                console.warn(`Failed to load prompt: ${promptName}`);
            }
        } catch (error) {
            console.error(`Error loading prompt ${promptName}:`, error);
        }
    }
}

document.addEventListener('DOMContentLoaded', init);
