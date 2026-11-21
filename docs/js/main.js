/**
 * Game Agent Coding League - Main Application Logic
 * Renders the leaderboard and head-to-head matrices from precomputed results.
 */

let gameCharts = {};
let gameConfig = null;
let eloData = null;
let promptsLoaded = false;
const eloFilters = { weights: 'weighted', agents: 'max' };

/**
 * Initialize the application
 */
async function init() {
    try {
        initTabs();

        if (document.getElementById('page-games')) {
            loadAllPrompts();
        }

        const leaderboardPage = document.getElementById('page-results');
        const [config, manifest, ratings] = await Promise.all([
            loadConfig(),
            loadManifest(),
            leaderboardPage ? loadEloRatings() : null,
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

        if (leaderboardPage) {
            eloData = ratings;
            addWeightBadgesToLeaderboardTabs();
            initEloFilters();
            renderOverallLeaderboard();
            renderGameLeaderboards();
        }
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
    [/fable|claude|anthropic|opus|sonnet/i, 'data/media/claude.png'],
    [/meta|llama|muse/i, 'data/media/meta.png'],
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
 * Inline plugin: draws score values near the top of each bar
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

                let fontSize = isHovered ? 14 : 13;
                ctx.font = `bold ${fontSize}px sans-serif`;
                const maxWidth = Math.max(0, (bar.width || 0) - 4);
                const minFontSize = isHovered ? 12 : 10;
                if (maxWidth > 0) {
                    while (
                        ctx.measureText(text).width > maxWidth &&
                        fontSize > minFontSize
                    ) {
                        fontSize -= 1;
                        ctx.font = `bold ${fontSize}px sans-serif`;
                    }
                }

                const labelY = bar.y + 6;
                const textY = labelY + fontSize <= chart.chartArea.bottom ? labelY : bar.y - fontSize - 6;
                ctx.fillText(text, bar.x, textY);
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
function renderChart(canvasId, standings) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !standings.length || typeof Chart === 'undefined') return;

    const models = standings.map(entry => entry.model);
    const scores = standings.map(entry => entry.elo);
    const min = Math.floor(Math.min(...scores) / 100) * 100;
    const max = Math.ceil(Math.max(...scores) / 100) * 100;
    const yBounds = { min: min === max ? min - 100 : min, max };
    const colors = generateBarColors(scores.length);
    const hoverColors = generateBarHoverColors(scores.length);
    const data = {
        labels: models.map(formatModelName),
        datasets: [{
            label: 'Elo',
            data: scores,
            backgroundColor: colors,
            borderColor: colors.map(c => adjustColorBrightness(c, -20)),
            hoverBackgroundColor: hoverColors,
            hoverBorderColor: hoverColors.map(c => adjustColorBrightness(c, -20)),
            borderWidth: 1,
            borderRadius: 4
        }]
    };
    const chartId = canvasId.replace('chart-', '');
    const existing = gameCharts[chartId];
    if (existing) {
        existing.data.labels = data.labels;
        Object.assign(existing.data.datasets[0], data.datasets[0]);
        Object.assign(existing.options.scales.y, yBounds);
        existing.$barIconAssignment = buildIconAssignment(models);
        existing.update('none');
        return;
    }

    const chart = new Chart(ctx, {
        type: 'bar',
        data,
        options: {
            animation: false,
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
                        labelOffset: 20,
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    ...yBounds,
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
    chart.draw();
    gameCharts[chartId] = chart;
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

async function loadEloRatings() {
    const response = await fetch('/data/elo.json', { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`Failed to load Elo ratings (${response.status})`);
    }
    return response.json();
}

function renderOverallLeaderboard() {
    const field = eloFilters.agents === 'max' ? 'overall' : 'overall_mean';
    const rows = eloData[eloFilters.weights === 'weighted' ? field : `${field}_unweighted`];
    renderLeaderboard('overall', rows);
    renderChart('chart-overall', rows);
}

function renderGameLeaderboards() {
    for (const { id, code } of gameConfig.games) {
        const game = eloData.games[id];
        const rows = game?.models[eloFilters.agents] ?? [];
        renderLeaderboard(id, rows, game?.unit);
        renderChart(`chart-${id}`, rows);
        renderHeadToHead(id, game, rows.map(entry => entry.model), code === 'A3');
    }
}

function renderLeaderboard(tabId, rows, unit) {
    const container = document.getElementById(`leaderboard-${tabId}`);
    if (!container) return;
    if (!rows.length) {
        container.textContent = 'No Elo ratings available.';
        return;
    }

    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200';
    const head = table.createTHead();
    head.className = 'bg-gray-50 text-xs text-gray-500 uppercase tracking-wider';
    const header = head.insertRow();
    const showAgent = unit && eloFilters.agents === 'max';
    const headings = ['Rank', showAgent ? 'Agent' : 'Model'];
    if (unit) headings.push(showAgent ? `Rated ${unit}` : `Rated ${unit} across agents`);
    headings.push('Elo');
    headings.forEach((label, index) => {
        const cell = document.createElement('th');
        cell.scope = 'col';
        cell.className = index < 2 ? 'px-4 py-3 text-left' : 'px-4 py-3 text-right';
        cell.textContent = label;
        header.appendChild(cell);
    });

    const body = table.createTBody();
    body.className = 'divide-y divide-gray-200 text-sm text-gray-900';
    rows.forEach((entry, index) => {
        const row = body.insertRow();
        row.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        const values = [index + 1, showAgent ? entry.agent : entry.model];
        if (unit) values.push(entry.rated.toLocaleString());
        values.push(entry.elo.toFixed(2));
        values.forEach((value, column) => {
            const cell = row.insertCell();
            cell.className = column < 2 ? 'px-4 py-3' : 'px-4 py-3 text-right tabular-nums';
            cell.textContent = value;
        });
        row.cells[values.length - 1].classList.add('font-semibold');
    });

    container.replaceChildren(table);
}

function renderHeadToHead(tabId, game, models, wizard) {
    const container = document.getElementById(`head-to-head-${tabId}`);
    if (!container) return;

    const card = document.getElementById('head-to-head-template').content.cloneNode(true);
    const heading = card.querySelector('h3');
    const description = card.querySelector('p');
    const scroll = card.querySelector('.h2h-scroll');
    const results = game?.head_to_head;

    if (!models.length || !results || !Object.keys(results).length) {
        description.textContent = 'Head-to-head results are unavailable.';
        scroll.remove();
        container.replaceChildren(card);
        return;
    }

    heading.id = `head-to-head-title-${tabId}`;
    scroll.setAttribute('aria-labelledby', heading.id);
    const scope = wizard
        ? 'Wizard compares each pair’s final scores within the same main-event game.'
        : `Results pool all agents for each model and count individual ${game.unit}.`;
    description.textContent = `Read across for the row model’s score percentage and wins–draws–losses. A draw counts as half a win. ${scope}`;

    const table = document.createElement('table');
    table.className = 'h2h-table';
    const header = table.createTHead().insertRow();
    for (const label of ['Model / Opponent', ...models]) {
        const cell = document.createElement('th');
        cell.scope = 'col';
        cell.textContent = label;
        header.appendChild(cell);
    }

    const body = table.createTBody();
    for (const model of models) {
        const row = body.insertRow();
        const label = document.createElement('th');
        label.scope = 'row';
        label.textContent = model;
        row.appendChild(label);

        for (const opponent of models) {
            const cell = row.insertCell();
            const result = results[model]?.[opponent];
            if (!result) {
                cell.className = 'h2h-empty';
                cell.textContent = '—';
                cell.setAttribute('aria-label', model === opponent ? 'Same model' : 'No results');
                continue;
            }

            const { wins, draws, losses, score_pct } = result;
            if (wins > losses) cell.className = 'h2h-win';
            if (wins < losses) cell.className = 'h2h-loss';
            const score = document.createElement('span');
            score.className = 'h2h-score';
            score.textContent = `${score_pct.toFixed(1)}%`;
            const record = document.createElement('span');
            record.className = 'h2h-record';
            record.textContent = `${wins}–${draws}–${losses}`;
            cell.append(score, record);
        }
    }

    scroll.appendChild(table);
    container.replaceChildren(card);
}

/**
 * Lazy-load game prompts (called on first Games tab visit)
 */
async function loadAllPrompts() {
    const promptFiles = ['battleship', 'lieonce', 'wizard', 'backgammon', 'connect4', 'surround_morris', 'mancala', 'wordmatrix'];

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

function initEloFilters() {
    const overallAgentFilter = document.querySelector('#tab-overall [data-elo-filter="agents"]');
    if (overallAgentFilter) {
        for (const { id } of gameConfig.games) {
            const section = document.getElementById(`tab-${id}`);
            if (!section) continue;

            const group = overallAgentFilter.cloneNode(true);
            group.classList.add('mb-4');
            section.prepend(group);
        }
    }

    for (const filter of Object.keys(eloFilters)) {
        const buttons = document.querySelectorAll(`[data-elo-filter="${filter}"] button`);
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.dataset.mode;
                if (mode === eloFilters[filter]) return;

                eloFilters[filter] = mode;
                buttons.forEach(option => {
                    const active = option.dataset.mode === mode;
                    option.classList.toggle('active', active);
                    option.setAttribute('aria-pressed', active);
                });
                renderOverallLeaderboard();
                if (filter === 'agents') renderGameLeaderboards();
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', init);
