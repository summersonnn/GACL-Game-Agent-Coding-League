/**
 * Game Agent Coding League - Main Application Logic
 * Fetches pre-computed leaderboard JSON and renders charts/tables.
 */

let gameCharts = {};
let gameConfig = null;
let leaderboardData = null;
let promptsLoaded = false;

/**
 * Initialize the application
 */
async function init() {
    try {
        initTabs();

        if (document.getElementById('page-games')) {
            loadAllPrompts();
        }

        const [config, manifest] = await Promise.all([
            loadConfig(),
            loadManifest(),
            loadLeaderboards(),
        ]);

        gameConfig = config;
        gameConfig.games.forEach(game => {
            const span = document.querySelector(`[data-game-id="${game.id}"]`);
            if (span) span.textContent = `Weight: ${game.weight}`;
        });

        if (manifest.runs.length > 0) {
            const run = manifest.runs[0];
            const dateText = `Last run: ${run.date}`;
            document.querySelectorAll('.run-date').forEach(el => { el.textContent = dateText; });
        }

        renderAllCharts();
        renderAllLeaderboards();
    } catch (error) {
        console.error('Failed to initialize:', error);
        showError(`Failed to load game data. Error: ${error.message} \nPlease check the console for details.`);
    }
}

/**
 * Load game configuration
 */
async function loadConfig() {
    const response = await fetch('/data/config.json');
    if (!response.ok) {
        throw new Error(`Failed to load config: ${response.status}`);
    }
    return response.json();
}

/**
 * Load the runs manifest
 */
async function loadManifest() {
    const response = await fetch('/data/runs.json');
    if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.status}`);
    }
    return response.json();
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

            if (gameCharts[targetTab]) {
                gameCharts[targetTab].resize();
            }
        });
    });
}

/**
 * Render all charts (Overall + individual games)
 */
function renderAllCharts() {
    renderOverallChart();

    gameConfig.games.forEach(game => {
        renderGameChart(game.id, game.name);
    });
}

/**
 * Render overall weighted chart
 */
function renderOverallChart() {
    if (!leaderboardData || !leaderboardData.overall) {
        console.warn('No overall score data available');
        return;
    }

    const overallScores = leaderboardData.overall;
    if (overallScores.length === 0) return;

    const labels = overallScores.map(entry => entry.model);
    const scores = overallScores.map(entry => entry.overall_score);

    renderChart('chart-overall', 'Overall Score', labels, scores);
}

/**
 * Render individual game chart
 */
function renderGameChart(gameId, gameName) {
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
 * Inline plugin: draws score values inside the top of each bar
 */
const barValuePlugin = {
    id: 'barValues',
    afterDatasetsDraw(chart) {
        const { ctx } = chart;
        chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            meta.data.forEach((bar, index) => {
                const value = dataset.data[index];
                ctx.save();
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(Math.round(value), bar.x, bar.y + 6);
                ctx.restore();
            });
        });
    }
};

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
        },
        plugins: [barValuePlugin]
    });

    gameCharts[canvasId.replace('chart-', '')] = chart;
}

/**
 * Generate bar colors: top 5 get special colors, rest are grey
 */
function generateBarColors(count) {
    const TOP_5 = ['#D4AF37', '#94A3B8', '#B87333', '#7C3AED', '#0891B2'];
    const GREY = '#CBD5E1';
    return Array.from({ length: count }, (_, i) => i < 5 ? TOP_5[i] : GREY);
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
        const response = await fetch('/data/leaderboard.json');
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

        const modelName = entry.model;

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
 * Lazy-load game prompts (called on first Games tab visit)
 */
async function loadAllPrompts() {
    const promptFiles = ['battleship', 'tictactoe', 'wizard', 'wordfinder', 'connect4', 'surround_morris', 'minichess', 'wordmatrix'];

    const fetches = promptFiles.map(async (promptName) => {
        try {
            const response = await fetch(`/data/full_prompts/${promptName}.txt`);
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
    });

    await Promise.all(fetches);
}

document.addEventListener('DOMContentLoaded', init);
