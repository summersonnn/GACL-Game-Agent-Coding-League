/**
 * Main application logic for Kubi's Benchmark Leaderboard
 * Handles HTML parsing, table initialization, and run selection
 */

// Global state
let summaryTable = null;
let detailTable = null;
let scoreChart = null;
let currentData = null;

// Category display order
const CATEGORY_ORDER = [
    'Reasoning',
    'General Knowledge',
    'Math',
    'Basic Mix'
];

/**
 * Initialize the application
 */
async function init() {
    try {
        initTabs();
        initChartCategorySelector();
        const manifest = await loadManifest();
        populateRunSelector(manifest.runs);

        if (manifest.runs.length > 0) {
            await loadRun(manifest.runs[0].file);
        }
    } catch (error) {
        console.error('Failed to initialize:', error);
        showError('Failed to load benchmark data. Please check the console for details.');
    }
}

/**
 * Initialize chart category selector
 */
function initChartCategorySelector() {
    const selector = document.getElementById('chart-category');
    if (selector) {
        selector.addEventListener('change', () => {
            if (currentData) {
                renderChart(currentData);
            }
        });
    }
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

            // Update button states
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update content visibility
            tabContents.forEach(content => {
                if (content.id === `tab-${targetTab}`) {
                    content.classList.remove('hidden');
                    content.classList.add('active');
                } else {
                    content.classList.add('hidden');
                    content.classList.remove('active');
                }
            });

            // Re-render chart when tab becomes visible (Chart.js sizing issue)
            if (targetTab === 'chart' && currentData) {
                renderChart(currentData);
            }

            // Re-draw detailed table when tab becomes visible (Tabulator sizing issue)
            if (targetTab === 'details' && detailTable) {
                detailTable.redraw();
            }

        });
    });
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
 * Populate the run selector dropdown
 */
function populateRunSelector(runs) {
    const selector = document.getElementById('run-selector');
    selector.innerHTML = '';

    runs.forEach((run, index) => {
        const option = document.createElement('option');
        option.value = run.file;
        option.textContent = run.name || run.date;
        if (index === 0) option.selected = true;
        selector.appendChild(option);
    });

    selector.addEventListener('change', async (e) => {
        if (e.target.value) {
            await loadRun(e.target.value);
        }
    });
}

/**
 * Load and parse a benchmark run HTML file
 */
async function loadRun(filename) {
    try {
        const response = await fetch(`data/runs/${filename}?t=${new Date().getTime()}`);
        if (!response.ok) {
            throw new Error(`Failed to load run: ${response.status}`);
        }

        const html = await response.text();
        currentData = parseHTML(html);

        updateRunDate(filename);
        renderSummaryTable(currentData);
        renderDetailTable(currentData);
        renderChart(currentData);
    } catch (error) {
        console.error('Failed to load run:', error);
        showError(`Failed to load benchmark run: ${filename}`);
    }
}

/**
 * Update the displayed run date
 */
function updateRunDate(filename) {
    const match = filename.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (match) {
        const [, year, month, day, hour, min, sec] = match;
        const dateStr = `${year}-${month}-${day} ${hour}:${min}:${sec}`;
        document.getElementById('run-date').textContent = `Run: ${dateStr}`;
    }
}

/**
 * Parse benchmark HTML and extract data
 */
function parseHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract model names from header
    const modelHeaders = doc.querySelectorAll('th.model-header, th[class*="model-header"]');
    const models = Array.from(modelHeaders).map(th => th.textContent.trim());

    // If no model-header class, try to find headers with colspan="3"
    if (models.length === 0) {
        const colspanHeaders = doc.querySelectorAll('thead tr:first-child th[colspan="3"]');
        colspanHeaders.forEach(th => models.push(th.textContent.trim()));
    }

    // Extract question data from tbody rows
    const questions = [];
    const rows = doc.querySelectorAll('tbody tr');

    rows.forEach(row => {
        const category = row.dataset.category || 'Uncategorized';
        const subcategory = row.dataset.subcategory || '';

        const cells = row.querySelectorAll('td');
        if (cells.length < 2) return;

        // First cell is question index (e.g., "A5-V-terminal-unzip")
        const questionFull = cells[0].textContent.trim();
        const questionIndex = extractQuestionIndex(questionFull);

        // Second cell is points
        const points = parseFloat(cells[1].textContent.trim()) || 0;

        // Remaining cells are model results (3 per model: score, tokens, cost)
        const modelResults = {};
        let cellIndex = 2;

        models.forEach(model => {
            if (cellIndex + 2 < cells.length) {
                const scoreCell = cells[cellIndex];
                const tokensCell = cells[cellIndex + 1];
                const costCell = cells[cellIndex + 2];

                modelResults[model] = {
                    score: parseScore(scoreCell),
                    scoreRaw: scoreCell.textContent.trim(),
                    scoreClass: getScoreClass(scoreCell),
                    tokens: parseTokens(tokensCell.textContent.trim()),
                    cost: parseCost(costCell.textContent.trim())
                };

                cellIndex += 3;
            }
        });

        questions.push({
            index: questionIndex,
            fullName: questionFull,
            points,
            category,
            subcategory,
            results: modelResults
        });
    });

    // Extract totals from tfoot
    const totals = {};
    const tfootCells = doc.querySelectorAll('tfoot td');

    if (tfootCells.length > 2) {
        let cellIndex = 1; // Skip first cell (colspan="2" label)
        models.forEach(model => {
            if (cellIndex + 2 < tfootCells.length) {
                totals[model] = {
                    score: tfootCells[cellIndex].textContent.trim(),
                    tokens: parseTokens(tfootCells[cellIndex + 1].textContent.trim()),
                    cost: parseCost(tfootCells[cellIndex + 2].textContent.trim())
                };
                cellIndex += 3;
            }
        });
    }

    return { models, questions, totals };
}

/**
 * Extract question index (e.g., "A5" from "A5-V-terminal-unzip")
 */
function extractQuestionIndex(fullName) {
    const match = fullName.match(/^(A\d+)/i);
    return match ? match[1] : fullName;
}

/**
 * Parse score value from cell
 */
function parseScore(cell) {
    const text = cell.textContent.trim().toUpperCase();
    if (text === 'PASS') return 1;
    if (text === 'FAIL') return 0;
    return parseFloat(text) || 0;
}

/**
 * Get score class for styling
 */
function getScoreClass(cell) {
    const text = cell.textContent.trim().toUpperCase();
    if (text === 'PASS' || cell.classList.contains('pass')) return 'pass';
    if (text === 'FAIL' || cell.classList.contains('fail')) return 'fail';
    return 'partial';
}

/**
 * Parse tokens string to number
 */
function parseTokens(str) {
    return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
}

/**
 * Parse cost string to number
 */
function parseCost(str) {
    const match = str.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
}

/**
 * Render the summary/leaderboard table
 */
function renderSummaryTable(data) {
    // Calculate category scores for each model
    const categoryScores = {};
    const categoryMaxScores = {};

    // Calculate max score for all questions
    const totalMaxScore = data.questions.reduce((sum, q) => sum + q.points, 0);

    const summaryCategories = ['Basic Mix', 'General Knowledge', 'Math', 'Reasoning'];

    summaryCategories.forEach(category => {
        categoryMaxScores[category] = data.questions
            .filter(q => q.category === category)
            .reduce((sum, q) => sum + q.points, 0);
    });

    // Calculate scores for each model
    const modelTotalScores = {};
    data.models.forEach(model => {
        categoryScores[model] = {};

        // Calculate total score from all questions
        modelTotalScores[model] = data.questions.reduce((sum, q) => {
            const result = q.results[model];
            if (!result) return sum;
            if (result.scoreClass === 'pass') return sum + q.points;
            if (result.scoreClass === 'fail') return sum;
            return sum + (result.score || 0);
        }, 0);

        // Calculate category scores
        summaryCategories.forEach(category => {
            const categoryQuestions = data.questions.filter(q => q.category === category);
            const score = categoryQuestions.reduce((sum, q) => {
                const result = q.results[model];
                if (!result) return sum;
                if (result.scoreClass === 'pass') return sum + q.points;
                if (result.scoreClass === 'fail') return sum;
                return sum + (result.score || 0);
            }, 0);
            categoryScores[model][category] = score;
        });
    });

    const tableData = data.models.map((model, index) => {
        const total = data.totals[model] || {};
        const scoreNum = modelTotalScores[model] || 0;
        const tokens = total.tokens || 0;
        const cost = total.cost || 0;

        return {
            rank: index + 1,
            model: model,
            score: `${formatScore(scoreNum)}/${totalMaxScore}`,
            scoreNum: scoreNum,
            tokens: tokens,
            cost: cost,
            basicMixScore: categoryScores[model]['Basic Mix'] || 0,
            basicMixMax: categoryMaxScores['Basic Mix'] || 0,
            generalKnowledgeScore: categoryScores[model]['General Knowledge'] || 0,
            generalKnowledgeMax: categoryMaxScores['General Knowledge'] || 0,
            mathScore: categoryScores[model]['Math'] || 0,
            mathMax: categoryMaxScores['Math'] || 0,
            reasoningScore: categoryScores[model]['Reasoning'] || 0,
            reasoningMax: categoryMaxScores['Reasoning'] || 0
        };
    });

    // Sort by score descending
    tableData.sort((a, b) => b.scoreNum - a.scoreNum);

    // Update ranks after sorting
    tableData.forEach((row, index) => {
        row.rank = index + 1;
    });

    if (summaryTable) {
        summaryTable.replaceData(tableData);
    } else {
        summaryTable = new Tabulator('#summary-table', {
            data: tableData,
            layout: 'fitColumns',
            responsiveLayout: 'collapse',
            columns: [
                {
                    title: 'Rank',
                    field: 'rank',
                    width: 90,
                    hozAlign: 'center',
                    formatter: rankFormatter
                },
                {
                    title: 'Model',
                    field: 'model',
                    minWidth: 120,
                    formatter: modelFormatter
                },
                {
                    title: 'Score',
                    field: 'score',
                    width: 90,
                    hozAlign: 'center',
                    sorter: 'number',
                    sorterParams: { alignEmptyValues: 'bottom' },
                    formatter: (cell) => `<span class="total-score">${cell.getValue()}</span>`
                },
                {
                    title: '🪙',
                    field: 'tokens',
                    width: 90,
                    hozAlign: 'right',
                    sorter: 'number',
                    headerTooltip: 'Tokens',
                    formatter: (cell) => {
                        const val = cell.getValue();
                        return `<span class="tokens-cell">${(val || 0).toLocaleString()}</span>`;
                    }
                },
                {
                    title: '💵',
                    field: 'cost',
                    width: 90,
                    hozAlign: 'right',
                    sorter: 'number',
                    headerTooltip: 'Cost',
                    formatter: (cell) => {
                        const val = cell.getValue();
                        return `<span class="cost-cell">$${(val || 0).toFixed(2)}</span>`;
                    }
                },
                {
                    title: '🧠',
                    field: 'reasoningScore',
                    width: 90,
                    hozAlign: 'center',
                    sorter: 'number',
                    headerTooltip: 'Reasoning',
                    formatter: (cell) => {
                        const row = cell.getRow().getData();
                        return `<span class="score-partial">${formatScore(row.reasoningScore)}/${row.reasoningMax}</span>`;
                    }
                },
                {
                    title: '🌍',
                    field: 'generalKnowledgeScore',
                    width: 90,
                    hozAlign: 'center',
                    sorter: 'number',
                    headerTooltip: 'General Knowledge',
                    formatter: (cell) => {
                        const row = cell.getRow().getData();
                        return `<span class="score-partial">${formatScore(row.generalKnowledgeScore)}/${row.generalKnowledgeMax}</span>`;
                    }
                },
                {
                    title: '🧮',
                    field: 'mathScore',
                    width: 90,
                    hozAlign: 'center',
                    sorter: 'number',
                    headerTooltip: 'Math',
                    formatter: (cell) => {
                        const row = cell.getRow().getData();
                        return `<span class="score-partial">${formatScore(row.mathScore)}/${row.mathMax}</span>`;
                    }
                },
                {
                    title: '🧩',
                    field: 'basicMixScore',
                    width: 90,
                    hozAlign: 'center',
                    sorter: 'number',
                    headerTooltip: 'Basic Mix',
                    formatter: (cell) => {
                        const row = cell.getRow().getData();
                        return `<span class="score-partial">${formatScore(row.basicMixScore)}/${row.basicMixMax}</span>`;
                    }
                }
            ],
            initialSort: [{ column: 'scoreNum', dir: 'desc' }]
        });
    }
}

/**
 * Parse total score string to number (e.g., "36.75/41" -> 36.75)
 */
function parseScoreTotal(scoreStr) {
    if (!scoreStr) return 0;
    const match = scoreStr.match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : 0;
}

/**
 * Format score to max 2 decimal places (removes trailing zeros)
 */
function formatScore(score) {
    if (Number.isInteger(score)) return score.toString();
    const rounded = Math.round(score * 100) / 100;
    return rounded.toString();
}

/**
 * Format rank with medals
 */
function rankFormatter(cell) {
    const rank = cell.getValue();
    if (rank === 1) {
        return `<span class="rank-medal rank-gold">1</span>`;
    } else if (rank === 2) {
        return `<span class="rank-medal rank-silver">2</span>`;
    } else if (rank === 3) {
        return `<span class="rank-medal rank-bronze">3</span>`;
    }
    return `<span class="rank-number">${rank}</span>`;
}

/**
 * Format model name
 */
function modelFormatter(cell) {
    const model = cell.getValue();
    return `<span class="model-name">${model}</span>`;
}

/**
 * Render the detailed results table
 */
function renderDetailTable(data) {
    // Calculate actual scores from questions for sorting
    const modelScores = {};
    data.models.forEach(model => {
        modelScores[model] = data.questions.reduce((sum, q) => {
            const result = q.results[model];
            if (!result) return sum;
            const scoreClass = result.scoreClass;
            if (scoreClass === 'pass') return sum + q.points;
            if (scoreClass === 'fail') return sum;
            return sum + (result.score || 0);
        }, 0);
    });

    // Sort models by score (highest first)
    const sortedModels = [...data.models].sort((a, b) => {
        return modelScores[b] - modelScores[a];
    });

    // Build columns dynamically based on models
    const columns = [
        {
            title: 'Question',
            field: 'index',
            width: 100,
            frozen: true,
            headerSort: false,
            formatter: (cell) => `<span class="question-index">${cell.getValue()}</span>`
        },
        {
            title: 'Points',
            field: 'points',
            width: 80,
            hozAlign: 'center',
            headerSort: false,
            formatter: (cell) => `<span class="points-cell">${cell.getValue()}</span>`
        }
    ];

    // Add columns for each model (sorted by score, highest first)
    sortedModels.forEach(model => {
        columns.push({
            title: model,
            columns: [
                {
                    title: 'Score',
                    field: `${model}_score`,
                    width: 90,
                    hozAlign: 'center',
                    headerSort: false,
                    formatter: scoreFormatter
                },
                {
                    title: 'Tokens',
                    field: `${model}_tokens`,
                    width: 90,
                    hozAlign: 'right',
                    headerSort: false,
                    formatter: (cell) => {
                        const val = cell.getValue();
                        return `<span class="tokens-cell">${(val || 0).toLocaleString()}</span>`;
                    }
                },
                {
                    title: 'Cost',
                    field: `${model}_cost`,
                    width: 80,
                    hozAlign: 'right',
                    headerSort: false,
                    formatter: (cell) => {
                        const val = cell.getValue();
                        return `<span class="cost-cell">$${(val || 0).toFixed(2)}</span>`;
                    }
                }
            ]
        });
    });

    // Transform question data to flat rows
    const tableData = data.questions.map(q => {
        const row = {
            index: q.index,
            points: q.points,
            category: q.category,
            subcategory: q.subcategory || '(none)',
            _categoryOrder: CATEGORY_ORDER.indexOf(q.category),
            _isTotal: false
        };

        data.models.forEach(model => {
            const result = q.results[model] || {};
            row[`${model}_score`] = result.score || 0;
            row[`${model}_scoreRaw`] = result.scoreRaw || '0';
            row[`${model}_scoreClass`] = result.scoreClass || 'fail';
            row[`${model}_tokens`] = result.tokens || 0;
            row[`${model}_cost`] = result.cost || 0;
        });

        return row;
    });

    // Sort by category order, then subcategory, then index
    tableData.sort((a, b) => {
        if (a._categoryOrder !== b._categoryOrder) {
            return a._categoryOrder - b._categoryOrder;
        }
        if (a.subcategory !== b.subcategory) {
            return a.subcategory.localeCompare(b.subcategory);
        }
        return a.index.localeCompare(b.index);
    });

    // Calculate and add category totals
    CATEGORY_ORDER.forEach(category => {
        const categoryQuestions = tableData.filter(q => q.category === category && !q._isTotal);
        if (categoryQuestions.length === 0) return;

        const totalRow = {
            index: 'Total',
            points: categoryQuestions.reduce((sum, q) => sum + q.points, 0),
            category: category,
            subcategory: 'zzz_Total', // zzz to sort last
            _categoryOrder: CATEGORY_ORDER.indexOf(category),
            _isTotal: true
        };

        sortedModels.forEach(model => {
            // PASS = full points, FAIL = 0, numeric = absolute value
            const totalScore = categoryQuestions.reduce((sum, q) => {
                const scoreClass = q[`${model}_scoreClass`];
                if (scoreClass === 'pass') return sum + q.points;
                if (scoreClass === 'fail') return sum + 0;
                // Partial score - use the raw numeric value
                return sum + (q[`${model}_score`] || 0);
            }, 0);
            const totalTokens = categoryQuestions.reduce((sum, q) => sum + (q[`${model}_tokens`] || 0), 0);
            const totalCost = categoryQuestions.reduce((sum, q) => sum + (q[`${model}_cost`] || 0), 0);
            const maxScore = categoryQuestions.reduce((sum, q) => sum + q.points, 0);

            totalRow[`${model}_score`] = totalScore;
            totalRow[`${model}_scoreRaw`] = `${formatScore(totalScore)}/${maxScore}`;
            totalRow[`${model}_scoreClass`] = 'total';
            totalRow[`${model}_tokens`] = totalTokens;
            totalRow[`${model}_cost`] = totalCost;
        });

        tableData.push(totalRow);
    });

    // Add grand total row
    const allQuestions = tableData.filter(q => !q._isTotal);
    const grandTotalRow = {
        index: 'TOTAL',
        points: allQuestions.reduce((sum, q) => sum + q.points, 0),
        category: 'zzz_Grand Total', // zzz to sort last
        subcategory: '',
        _categoryOrder: 999,
        _isTotal: true
    };

    sortedModels.forEach(model => {
        // PASS = full points, FAIL = 0, numeric = absolute value
        const totalScore = allQuestions.reduce((sum, q) => {
            const scoreClass = q[`${model}_scoreClass`];
            if (scoreClass === 'pass') return sum + q.points;
            if (scoreClass === 'fail') return sum + 0;
            // Partial score - use the raw numeric value
            return sum + (q[`${model}_score`] || 0);
        }, 0);
        const totalTokens = allQuestions.reduce((sum, q) => sum + (q[`${model}_tokens`] || 0), 0);
        const totalCost = allQuestions.reduce((sum, q) => sum + (q[`${model}_cost`] || 0), 0);
        const maxScore = allQuestions.reduce((sum, q) => sum + q.points, 0);

        grandTotalRow[`${model}_score`] = totalScore;
        grandTotalRow[`${model}_scoreRaw`] = `${formatScore(totalScore)}/${maxScore}`;
        grandTotalRow[`${model}_scoreClass`] = 'total';
        grandTotalRow[`${model}_tokens`] = totalTokens;
        grandTotalRow[`${model}_cost`] = totalCost;
    });

    tableData.push(grandTotalRow);

    // Re-sort to include totals in correct positions
    tableData.sort((a, b) => {
        if (a._categoryOrder !== b._categoryOrder) {
            return a._categoryOrder - b._categoryOrder;
        }
        if (a.subcategory !== b.subcategory) {
            return a.subcategory.localeCompare(b.subcategory);
        }
        return a.index.localeCompare(b.index);
    });

    // Destroy and recreate table to handle column reordering
    if (detailTable) {
        detailTable.destroy();
    }

    detailTable = new Tabulator('#detail-table', {
        data: tableData,
        layout: 'fitDataFill',
        groupBy: ['category', 'subcategory'],
        groupStartOpen: [true, true],
        groupHeader: (value, count, data, group) => {
            const level = group.getParentGroup() ? 1 : 0;
            // Handle special total category
            if (value === 'zzz_Grand Total') {
                return `<span style="font-weight: 700;">Grand Total</span>`;
            }
            if (level === 0) {
                return `<span style="font-weight: 600;">${value}</span> <span style="opacity: 0.7; margin-left: 8px;">(${count} questions)</span>`;
            }
            // Handle subcategory totals
            if (value === 'zzz_Total') {
                return `<span style="font-weight: 600; padding-left: 10px;">Category Total</span>`;
            }
            return `<span style="font-weight: 500; padding-left: 10px;">${value === '(none)' ? 'General' : value}</span> <span style="opacity: 0.7; margin-left: 8px;">(${count})</span>`;
        },
        columns: columns,
        columnDefaults: {
            headerSort: false,
            headerHozAlign: 'center'
        }
    });
}

/**
 * Render the bar chart showing model scores
 */
function renderChart(data) {
    const ctx = document.getElementById('score-chart');
    if (!ctx) return;

    // Get selected category
    const categorySelector = document.getElementById('chart-category');
    const selectedCategory = categorySelector ? categorySelector.value : 'General';

    // Prepare chart data - calculate scores based on selected category
    const chartData = data.models.map(model => {
        let score = 0;
        let maxScore = 0;

        // Filter questions by category (or all for General)
        const questions = selectedCategory === 'General'
            ? data.questions
            : data.questions.filter(q => q.category === selectedCategory);

        maxScore = questions.reduce((sum, q) => sum + q.points, 0);
        score = questions.reduce((sum, q) => {
            const result = q.results[model];
            if (!result) return sum;
            if (result.scoreClass === 'pass') return sum + q.points;
            if (result.scoreClass === 'fail') return sum;
            return sum + (result.score || 0);
        }, 0);

        return {
            model: model,
            score: score,
            maxScore: maxScore
        };
    }).sort((a, b) => b.score - a.score);

    const labels = chartData.map(d => d.model);
    const scores = chartData.map(d => d.score);

    // Generate colors - gradient from best to worst
    const colors = generateBarColors(scores.length);

    // Destroy existing chart if any
    if (scoreChart) {
        scoreChart.destroy();
    }

    scoreChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Score',
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
            indexAxis: 'x',
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
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

/**
 * Generate gradient colors for bar chart (similar to example)
 */
function generateBarColors(count) {
    const colors = [];
    // Start with muted teal/olive tones like the example
    const baseHues = [160, 50, 45, 40, 35]; // Teal to olive/tan gradient

    for (let i = 0; i < count; i++) {
        const progress = i / Math.max(count - 1, 1);
        // Interpolate between teal (160) and tan/gray (40)
        const hue = 160 - (progress * 120);
        const saturation = 25 - (progress * 10); // Decrease saturation
        const lightness = 45 + (progress * 20); // Increase lightness (lighter grays)
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    return colors;
}

/**
 * Adjust color brightness
 */
function adjustColorBrightness(color, amount) {
    // For HSL colors, adjust lightness
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
 * Format score cell with badge
 */
function scoreFormatter(cell) {
    const row = cell.getRow().getData();
    if (!row) return '';

    const field = cell.getField();
    const modelName = field.replace('_score', '');
    const rawValue = row[`${modelName}_scoreRaw`];
    const scoreClass = row[`${modelName}_scoreClass`];

    if (scoreClass === 'total') {
        return `<span class="score-total">${rawValue}</span>`;
    } else if (scoreClass === 'pass') {
        return `<span class="score-pass">PASS</span>`;
    } else if (scoreClass === 'fail') {
        return `<span class="score-fail">FAIL</span>`;
    } else {
        // Format partial score to max 2 decimal places
        const numValue = parseFloat(rawValue);
        const formatted = isNaN(numValue) ? rawValue : formatScore(numValue);
        return `<span class="score-partial">${formatted}</span>`;
    }
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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
