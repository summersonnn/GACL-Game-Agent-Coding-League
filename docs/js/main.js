/**
 * Game Agent Coding League - Main Application Logic
 * Fetches pre-computed leaderboard JSON and renders charts/tables.
 */

let gameCharts = {};
let gameConfig = null;
let leaderboardData = null;
let promptsLoaded = false;
let currentOverallMode = 'weighted';

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

        addWeightBadgesToLeaderboardTabs();
        initOverallModeToggle();

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
        console.warn('No overall point data available');
        return;
    }

    const overallScores = currentOverallMode === 'weighted'
        ? leaderboardData.overall
        : computeUnweightedOverall();

    if (overallScores.length === 0) return;

    const labels = overallScores.map(entry => formatModelName(entry.model));
    const scores = overallScores.map(entry => entry.overall_score);
    const models = overallScores.map(entry => entry.model);

    renderChart('chart-overall', 'Overall Points', labels, scores, models);
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

    const labels = sorted.map(entry => formatModelName(entry.model));
    const scores = sorted.map(entry => entry.normalized);
    const models = sorted.map(entry => entry.model);

    renderChart(`chart-${gameId}`, gameName, labels, scores, models);
}

const MODEL_LABEL_RULES = [
    [/^anthropic-claude-/i, 'Claude '],
    [/^anthropic-/i, ''],
    [/^openai-gpt-/i, 'GPT '],
    [/^openai-/i, ''],
    [/^google-gemini-/i, 'Gemini '],
    [/^google-gemma-/i, 'Gemma '],
    [/^google-/i, ''],
    [/^moonshotai-kimi-/i, 'Kimi '],
    [/^moonshotai-/i, ''],
    [/^minimax-minimax-/i, 'MiniMax '],
    [/^minimax-/i, ''],
    [/^mistralai-mistral-/i, 'Mistral '],
    [/^mistralai-/i, ''],
    [/^deepseek-deepseek-/i, 'DeepSeek '],
    [/^deepseek-/i, ''],
    [/^qwen-qwen/i, 'Qwen'],
    [/^qwen-/i, ''],
    [/^nvidia-nemotron-/i, 'Nemotron '],
    [/^nvidia-/i, ''],
    [/^xiaomi-mimo-/i, 'MiMo '],
    [/^xiaomi-/i, ''],
    [/^x-ai-grok-/i, 'Grok '],
    [/^x-ai-/i, ''],
    [/^z-ai-glm-/i, 'GLM '],
    [/^z-ai-/i, ''],
    [/^stepfun-step-/i, 'Step '],
    [/^stepfun-/i, '']
];

function formatModelName(model) {
    if (!model) return model;
    let s = model;
    for (const [re, prefix] of MODEL_LABEL_RULES) {
        if (re.test(s)) {
            s = s.replace(re, prefix);
            break;
        }
    }
    s = s.replace(/[-_]/g, ' ').trim();
    s = s.replace(/\b\w/g, c => c.toUpperCase());
    return s;
}

const ICON_RULES = [
    [/claude|anthropic/i, 'data/media/claude.png'],
    [/openai|gpt/i, 'data/media/openai.png'],
    [/gemini|gemma|google/i, 'data/media/gemini.png'],
    [/kimi|moonshot/i, 'data/media/kimi.png'],
    [/z-ai|glm|zai/i, 'data/media/zai.png'],
    [/grok|x-ai/i, 'data/media/grok.png'],
    [/xiaomi|mimo/i, 'data/media/mi.png'],
    [/minimax/i, 'data/media/minimax.png'],
    [/qwen|alibaba/i, 'data/media/qwen.png'],
    [/deepseek/i, 'data/media/deepseek.png']
];

const iconImageCache = {};
function getIconForModel(model) {
    if (!model) return null;
    for (const [re, src] of ICON_RULES) {
        if (re.test(model)) {
            if (!iconImageCache[src]) {
                const img = new Image();
                img.onload = () => {
                    Object.values(gameCharts).forEach(c => c && c.draw && c.draw());
                };
                img.src = src;
                iconImageCache[src] = img;
            }
            return iconImageCache[src];
        }
    }
    return null;
}

function buildIconAssignment(models) {
    return (models || []).map(getIconForModel);
}

/**
 * Inline plugin: draws score values inside the top of each bar
 */
const barValuePlugin = {
    id: 'barValues',
    afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const active = chart.getActiveElements ? chart.getActiveElements() : [];
        const activeKey = new Set(
            active.map(a => `${a.datasetIndex}:${a.index}`)
        );
        chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            meta.data.forEach((bar, index) => {
                const value = dataset.data[index];
                const isHovered = activeKey.has(`${datasetIndex}:${index}`);
                const text = isHovered
                    ? Number(value).toFixed(2)
                    : String(Math.round(value));

                ctx.save();
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                let fontSize = 11;
                ctx.font = `bold ${fontSize}px sans-serif`;
                const maxWidth = Math.max(0, (bar.width || 0) - 4);
                if (maxWidth > 0) {
                    while (
                        ctx.measureText(text).width > maxWidth &&
                        fontSize > 7
                    ) {
                        fontSize -= 1;
                        ctx.font = `bold ${fontSize}px sans-serif`;
                    }
                }

                ctx.fillText(text, bar.x, bar.y + 6);
                ctx.restore();

                const assignment = chart.$barIconAssignment || [];
                const icon = datasetIndex === 0 ? assignment[index] : null;
                if (icon && icon.complete && icon.naturalWidth > 0) {
                    const barWidth = bar.width || 0;
                    const barHeight = Math.abs((bar.base || 0) - bar.y);
                    const circleSize = Math.min(barWidth - 4, barHeight - 4, 36);
                    if (circleSize > 8) {
                        const radius = circleSize / 2;
                        const cx = bar.x;
                        const cy = (bar.base || 0) - radius - 4;
                        const iconSize = circleSize * 0.7;
                        const iconX = cx - iconSize / 2;
                        const iconY = cy - iconSize / 2;

                        ctx.save();
                        ctx.fillStyle = '#FFFFFF';
                        ctx.beginPath();
                        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.beginPath();
                        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                        ctx.clip();
                        ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
                        ctx.restore();
                    }
                }
            });
        });
    }
};

/**
 * Generic chart rendering function
 */
function renderChart(canvasId, label, labels, scores, models) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (gameCharts[canvasId.replace('chart-', '')]) {
        gameCharts[canvasId.replace('chart-', '')].destroy();
    }

    const colors = generateBarColors(scores.length);
    const hoverColors = generateBarHoverColors(scores.length);

    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Points',
                data: scores,
                backgroundColor: colors,
                borderColor: colors.map(c => adjustColorBrightness(c, -20)),
                hoverBackgroundColor: hoverColors,
                hoverBorderColor: hoverColors.map(c => adjustColorBrightness(c, -20)),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                intersect: true,
                axis: 'x'
            },
            onHover: (_event, _elements, chartInstance) => {
                chartInstance.draw();
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
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

    chart.$barIconAssignment = buildIconAssignment(models);
    gameCharts[canvasId.replace('chart-', '')] = chart;
}

/**
 * Generate bar colors: top 5 get special colors, rest are grey
 */
function generateBarColors(count) {
    const TOP_5 = ['#a0c3c4', '#93b5a7', '#aab788', '#bc976a', '#d4c68b'];
    const GREY = '#CBD5E1';
    return Array.from({ length: count }, (_, i) => i < 5 ? TOP_5[i] : GREY);
}

function generateBarHoverColors(count) {
    const TOP_5 = ['#6F8889', '#667E74', '#767F5F', '#83694A', '#948A61'];
    const GREY = '#94A3B8';
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

    const overallScores = currentOverallMode === 'weighted'
        ? leaderboardData.overall
        : computeUnweightedOverall();

    if (!overallScores || overallScores.length === 0) {
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
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Overall Points</th>
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

    if (gameId === 'game3') {
        thead.innerHTML = `
            <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Games</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">1st</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">2nd</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">3rd</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">4th</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">5th</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">6th</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Normalized<br>Points</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
            </tr>
        `;
    } else {
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
    }

    const tbody = document.createElement('tbody');
    tbody.className = 'bg-white divide-y divide-gray-200';

    sorted.forEach((entry, index) => {
        const row = document.createElement('tr');
        row.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';

        const modelName = entry.model;

        if (gameId === 'game3') {
            row.innerHTML = `
                <td class="px-4 py-3 text-sm text-gray-900">${index + 1}</td>
                <td class="px-4 py-3 text-sm font-medium text-gray-900">${modelName}</td>
                <td class="px-4 py-3 text-sm text-gray-600 text-right">${entry.games}</td>
                <td class="px-4 py-3 text-sm text-gray-600 text-right">${entry['1st']}</td>
                <td class="px-4 py-3 text-sm text-gray-600 text-right">${entry['2nd']}</td>
                <td class="px-4 py-3 text-sm text-gray-600 text-right">${entry['3rd']}</td>
                <td class="px-4 py-3 text-sm text-gray-600 text-right">${entry['4th']}</td>
                <td class="px-4 py-3 text-sm text-gray-600 text-right">${entry['5th']}</td>
                <td class="px-4 py-3 text-sm text-gray-600 text-right">${entry['6th']}</td>
                <td class="px-4 py-3 text-sm text-gray-600 text-right">${entry.points}</td>
                <td class="px-4 py-3 text-sm font-medium text-indigo-600 text-right">${entry.normalized.toFixed(2)}</td>
                <td class="px-4 py-3 text-sm font-semibold text-gray-900 text-right">${entry.score.toFixed(1)}</td>
            `;
        } else {
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
        }

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
    const promptFiles = ['battleship', 'lieonce', 'wizard', 'backgammon', 'connect4', 'surround_morris', 'minichess', 'wordmatrix'];

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

/**
 * Add weight badges to game tab chart headings on the leaderboard page
 */
function addWeightBadgesToLeaderboardTabs() {
    if (!gameConfig) return;

    gameConfig.games.forEach(game => {
        const section = document.getElementById(`tab-${game.id}`);
        if (!section) return;

        const heading = section.querySelector('h3');
        if (!heading || heading.querySelector('.weight-badge')) return;

        const badge = document.createElement('span');
        badge.className = 'weight-badge ml-2 text-xs font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded';
        badge.textContent = `Weight: ${game.weight}`;
        heading.appendChild(badge);
    });
}

/**
 * Initialize the weighted/unweighted toggle in the overall tab
 */
function initOverallModeToggle() {
    const buttons = document.querySelectorAll('.overall-mode-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            if (mode === currentOverallMode) return;

            currentOverallMode = mode;
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const suffix = mode === 'weighted' ? '(Games have different weights)' : '(Games have equal weights)';
            const chartTitle = document.getElementById('overall-chart-title');
            if (chartTitle) chartTitle.textContent = `Overall Performance ${suffix}`;

            renderOverallChart();
            renderOverallLeaderboard();
        });
    });
}

/**
 * Compute unweighted overall scores from per-game normalized values
 */
function computeUnweightedOverall() {
    if (!leaderboardData || !leaderboardData.overall) return [];

    return leaderboardData.overall
        .map(entry => {
            const scores = Object.values(entry.game_scores);
            const avg = scores.length > 0
                ? scores.reduce((a, b) => a + b, 0) / scores.length
                : 0;
            return { model: entry.model, overall_score: avg, game_scores: entry.game_scores };
        })
        .sort((a, b) => b.overall_score - a.overall_score);
}

document.addEventListener('DOMContentLoaded', init);
