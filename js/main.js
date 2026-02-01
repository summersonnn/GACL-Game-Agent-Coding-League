/**
 * Main application logic for Kubi's Benchmark Leaderboard
 * Handles HTML parsing, table initialization, and run selection
 */

let summaryTable = null;
let detailTable = null;
let scoreChart = null;
let currentData = null;
let currentRunFile = null;

// Category display order
const CATEGORY_ORDER = [
    'Reasoning',
    'General Knowledge',
    'Math',
    'Basic Mix'
];

// Questions to be marked with a star and highlighted
const STARRED_QUESTIONS = ['A3', 'A9', 'A17', 'A20', 'A26.1', 'A27'];

/**
 * Initialize the application
 */
async function init() {
    try {
        initTabs();
        initHomeNav();
        initCountdown();
        initChartCategorySelector();
        const manifest = await loadManifest();
        populateRunSelector(manifest.runs);

        if (manifest.runs.length > 0) {
            await loadRun(manifest.runs[0].file);
        }
    } catch (error) {
        console.error('Failed to initialize:', error);
        // Assuming showError is defined globally or we fallback to console
        if (typeof showError === 'function') {
            showError('Failed to load benchmark data. Please check the console for details.');
        }
    }
}

/**
 * Populate the run selector list in the sidebar with nested navigation
 */
function populateRunSelector(runs) {
    const listContainer = document.getElementById('run-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    runs.forEach((run, index) => {
        // Container for the run item and its sub-navigation
        const container = document.createElement('div');
        container.className = 'mb-1';

        // Run Header (The click target for the run)
        const header = document.createElement('div');
        header.className = 'run-item px-3 py-2 cursor-pointer hover:bg-gray-100 rounded transition-colors flex justify-between items-center';
        header.dataset.value = run.file;

        // Sub-navigation container
        const subNav = document.createElement('div');
        subNav.className = 'run-subnav hidden ml-2 mt-1 space-y-1 pl-2 border-l-2 border-gray-100';

        let displayTitle = run.name || 'Benchmark Run';
        let dateObj = null;

        // Extract date logic (same as before)
        if (run.file.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/)) {
            const match = run.file.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
            const [, year, month, day, hour, min] = match;
            dateObj = new Date(year, month - 1, day, hour, min);
        }

        let dateDisplay = '';
        if (dateObj) {
            const day = dateObj.getDate();
            const suffix = (day % 10 === 1 && day !== 11) ? 'st' :
                (day % 10 === 2 && day !== 12) ? 'nd' :
                    (day % 10 === 3 && day !== 13) ? 'rd' : 'th';

            const monthNames = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];
            dateDisplay = `${monthNames[dateObj.getMonth()]} ${day}${suffix}, ${dateObj.getFullYear()}`;
        } else {
            dateDisplay = run.date;
        }

        if (displayTitle.indexOf('2026-') !== -1 || displayTitle === run.date) {
            displayTitle = dateDisplay;
            dateDisplay = '';
        }

        header.innerHTML = `
            <div class="overflow-hidden">
                <div class="run-name truncate font-medium text-gray-700">${displayTitle}</div>
                ${dateDisplay ? `<div class="run-date truncate text-xs text-gray-400">${dateDisplay}</div>` : ''}
            </div>
            <div class="transform transition-transform duration-200 text-gray-400 text-xs">▼</div>
        `;

        // Sub-navigation buttons
        const btnResults = document.createElement('button');
        btnResults.className = 'w-full flex items-center px-3 py-1.5 text-xs font-medium rounded-md hover:bg-indigo-50 hover:text-indigo-700 text-gray-600';
        btnResults.innerHTML = '<span class="mr-2">📊</span> Results';

        const btnPublished = document.createElement('button');
        btnPublished.className = 'w-full flex items-center px-3 py-1.5 text-xs font-medium rounded-md hover:bg-indigo-50 hover:text-indigo-700 text-gray-600';
        btnPublished.innerHTML = '<span class="mr-2">📝</span> Questions';

        // Append buttons to subnav
        subNav.appendChild(btnResults);
        subNav.appendChild(btnPublished);

        // Helper to set UI active state
        const setActiveState = () => {
            // Remove active state from all items
            document.querySelectorAll('.run-item').forEach(el => el.classList.remove('bg-gray-100', 'active-run-header'));
            document.querySelectorAll('.run-subnav button').forEach(el => el.classList.remove('bg-indigo-50', 'text-indigo-700'));

            // Remove active state from Home
            const btnHome = document.getElementById('nav-home');
            if (btnHome) btnHome.classList.remove('bg-gray-100', 'text-gray-900');

            // Set active state for this run
            header.classList.add('bg-gray-100', 'active-run-header');

            // Ensure expanded
            subNav.classList.remove('hidden');
            const arrow = header.querySelector('.transform');
            if (arrow) arrow.classList.add('rotate-180');
        };

        const pageResults = document.getElementById('page-results');
        const pagePublished = document.getElementById('page-published');

        // Click handler for Run Header (Accordion behavior only)
        header.onclick = () => {
            const isHidden = subNav.classList.contains('hidden');

            // Collapse others (maintained behavior)
            document.querySelectorAll('.run-subnav').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.run-item .transform').forEach(el => el.classList.remove('rotate-180'));

            if (isHidden) {
                subNav.classList.remove('hidden');
                const arrow = header.querySelector('.transform');
                if (arrow) arrow.classList.add('rotate-180');
            }
        };

        // Click handler for Sub-Nav "Results"
        btnResults.onclick = async (e) => {
            e.stopPropagation();

            setActiveState();
            btnResults.classList.add('bg-indigo-50', 'text-indigo-700');

            // Load data if needed
            if (currentRunFile !== run.file) {
                updateHeaderTitle(displayTitle);
                await loadRun(run.file);
            }

            if (pageResults && pagePublished) {
                pageResults.classList.remove('hidden');
                pagePublished.classList.add('hidden');
                document.getElementById('page-home')?.classList.add('hidden');

                if (summaryTable) summaryTable.redraw();
                if (detailTable) detailTable.redraw();
            }
        };

        // Click handler for Sub-Nav "Published Questions"
        btnPublished.onclick = async (e) => {
            e.stopPropagation();

            setActiveState();
            btnPublished.classList.add('bg-indigo-50', 'text-indigo-700');

            // Load data if needed
            if (currentRunFile !== run.file) {
                updateHeaderTitle(displayTitle);
                await loadRun(run.file);
            }

            if (pageResults && pagePublished) {
                pageResults.classList.add('hidden');
                pagePublished.classList.remove('hidden');
                document.getElementById('page-home')?.classList.add('hidden');
            }
        };

        // Initial Selection logic
        if (index === 0) {
            header.onclick(); // Expand this one
            // Simulate click on results to load and set active
            // We can't click programmatically easily with the events passed, so just call logic
            header.classList.add('bg-gray-100', 'active-run-header');
            btnResults.classList.add('bg-indigo-50', 'text-indigo-700');
            // Data loading is handled by init() calling loadRun explicitly for first item
        }

        container.appendChild(header);
        container.appendChild(subNav);
        listContainer.appendChild(container);
    });
}

/**
 * Initialize Home navigation
 */
function initHomeNav() {
    const btnHome = document.getElementById('nav-home');
    if (!btnHome) return;

    btnHome.onclick = () => {
        // Clear run active states
        document.querySelectorAll('.run-item').forEach(el => el.classList.remove('bg-gray-100', 'active-run-header'));
        document.querySelectorAll('.run-subnav button').forEach(el => el.classList.remove('bg-indigo-50', 'text-indigo-700'));
        document.querySelectorAll('.run-subnav').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.run-item .transform').forEach(el => el.classList.remove('rotate-180'));

        // Set Home active
        btnHome.classList.add('bg-gray-100', 'text-gray-900');

        // Show Home page
        const pageHome = document.getElementById('page-home');
        const pageResults = document.getElementById('page-results');
        const pagePublished = document.getElementById('page-published');

        if (pageHome) pageHome.classList.remove('hidden');
        if (pageResults) pageResults.classList.add('hidden');
        if (pagePublished) pagePublished.classList.add('hidden');
    };
}


/**
 * Initialize Countdown Timer
 */
function initCountdown() {
    const timerEl = document.getElementById('countdown-timer');
    if (!timerEl) return;

    // Set target date to the 1st of the next month at midnight
    // Set target date to the 1st of the next month at midnight
    const now = new Date();
    // constructor(year, monthIndex, day) defaults to 00:00:00
    // getMonth() is 0-indexed. +1 moves to next month.
    // Date constructor handles overflow (e.g. month 12 becomes Jan next year) automatically.
    let targetDateObj = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // SKIP FEB 1, 2026 -> Go to March 1, 2026
    if (targetDateObj.getFullYear() === 2026 && targetDateObj.getMonth() === 1) {
        targetDateObj = new Date(2026, 2, 1);
    }

    const targetDate = targetDateObj.getTime();

    const updateTimer = () => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
            timerEl.textContent = "00:00:00:00";
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const pad = (n) => n.toString().padStart(2, '0');

        // Format: 02d 14h 33m 10s
        timerEl.textContent = `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
    };

    updateTimer();
    setInterval(updateTimer, 1000);
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
 * Update the header title with current run
 */
function updateHeaderTitle(title) {
    const titleEl = document.getElementById('current-run-title');
    if (titleEl) titleEl.textContent = title;
}

/**
 * Update the displayed run date
 */
function updateRunDate(filename) {
    const match = filename.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (match) {
        const [, year, month, day, hour, min, sec] = match;
        const dateStr = `${year}-${month}-${day} ${hour}:${min}:${sec}`;
        const dateEl = document.getElementById('run-date');
        if (dateEl) dateEl.textContent = `Run ID: ${dateStr}`;
    }
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
        currentRunFile = filename;

        updateRunDate(filename);
        renderSummaryTable(currentData);
        renderDetailTable(currentData);
        renderChart(currentData);

        // Load questions/markdown
        const mdFilename = filename.replace('.html', '.md');
        loadQuestions(mdFilename);
    } catch (error) {
        console.error('Failed to load run:', error);
        // showError might also be missing or I haven't seen it, but I'll assume it's global or I'll implement a simple one if needed.
        // Checking earlier file view, showError was called in init catch block (line 35).
        // Wait, where is showError defined? I didn't see it in Step 7 view (lines 1-800).
        // It might be further down or missing too?
        // Step 7 showed up to line 800.
        // Let's assume it's fine for now or simpler: console.error is enough.
        console.error(`Failed to load benchmark run: ${filename}`);
    }
}

/**
 * Load and render the markdown questions for a run
 */
async function loadQuestions(filename) {
    const container = document.getElementById('questions-content');
    if (!container) return;

    // Reset/Loading state
    container.innerHTML = '<div class="text-center text-gray-500 py-12">Loading questions...</div>';

    try {
        const response = await fetch(`data/runs/${filename}?t=${new Date().getTime()}`);

        if (response.ok) {
            const text = await response.text();
            // Configure marked
            const html = marked.parse(text);

            // Create a temporary container to manipulate the DOM
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            // Define the Logs HTML structure builder
            const createLogsSection = (logContent, questionId) => {
                const details = document.createElement('details');
                details.className = 'group mb-12 rounded-lg bg-gray-900 border border-gray-700 overflow-hidden';

                // If no logs found, maybe styled differently or just text
                // formatting the generic/missing msg
                const isGeneric = !logContent || logContent.startsWith("No logs found");

                details.innerHTML = `
                    <summary class="flex items-center justify-between p-4 cursor-pointer bg-gray-800 hover:bg-gray-750 transition-colors list-none">
                        <div class="flex items-center text-gray-200 font-medium select-none">
                            <span class="mr-2">📜</span> Execution Logs${questionId ? ` (${questionId})` : ''}
                        </div>
                        <div class="transform group-open:rotate-180 transition-transform duration-200 text-gray-400">
                            ▼
                        </div>
                    </summary>
                    <div class="p-4 bg-gray-950 text-gray-400 font-mono text-xs overflow-y-auto max-h-96 whitespace-pre-wrap custom-scrollbar border-t border-gray-800">${logContent || 'No logs available.'}</div>
                `;
                return details;
            };

            // 1. Identify all questions and their associated logs
            //    We assume each question starts with an <h3> containing the ID (e.g. "A3: ...")
            //    And the logs should be inserted before the next <hr> (or end of section)

            const headers = tempDiv.querySelectorAll('h3');
            const logFetches = [];

            // Helper to fetch log
            const fetchLog = async (id) => {
                try {
                    const res = await fetch(`data/logs/${id}_logs.txt`);
                    if (res.ok) {
                        return await res.text();
                    }
                } catch (e) {
                    console.warn(`Could not fetch logs for ${id}`, e);
                }
                return `No logs found for ${id}`;
            };

            // Using a loop to find insertion points matches and start fetches
            for (let i = 0; i < headers.length; i++) {
                const header = headers[i];
                const text = header.textContent.trim();
                const match = text.match(/^(A\d+(?:\.\d+)?)/); // e.g., A3, A26.1

                if (match) {
                    const questionId = match[1];

                    // Find the insertion point (the <hr> following this header, but before the next header)
                    // We iterate siblings until we find HR or the next H3
                    let currentNode = header.nextElementSibling;
                    let insertionPoint = null;

                    while (currentNode) {
                        if (currentNode.tagName === 'HR') {
                            insertionPoint = currentNode;
                            break;
                        }
                        if (currentNode.tagName === 'H3') {
                            // Hit the next question without seeing an HR, insert before this new header
                            // (Though usually markdown structure has HRs)
                            insertionPoint = currentNode;
                            break;
                        }
                        currentNode = currentNode.nextElementSibling;
                    }

                    // If we reached the end without HR or H3, append to end (handled by insertBefore(node, null))

                    logFetches.push({
                        id: questionId,
                        insertionPoint: insertionPoint,
                        parent: header.parentNode, // Should be tempDiv usually
                        limitNode: currentNode // For "end of container" check logic if needed
                    });
                }
            }

            // 2. Fetch all logs in parallel
            const logContents = await Promise.all(
                logFetches.map(async (item) => {
                    const content = await fetchLog(item.id);
                    return { ...item, content };
                })
            );

            // 3. Inject the log sections
            logContents.forEach(item => {
                const section = createLogsSection(item.content, item.id);
                if (item.insertionPoint) {
                    // standard case: before <hr>
                    item.parent.insertBefore(section, item.insertionPoint);
                } else {
                    // end of container case
                    item.parent.appendChild(section);
                }
            });

            // Render with Tailwind Typography (prose)
            container.innerHTML = `<div class="prose prose-indigo max-w-none text-left">${tempDiv.innerHTML}</div>`;
        } else {
            // Revert to placeholder/empty state
            container.innerHTML = `
                <div class="text-center">
                    <div class="text-6xl mb-4">📚</div>
                    <h3 class="text-xl font-medium text-gray-900 mb-2">Question Library</h3>
                    <p class="text-gray-500 max-w-lg mx-auto">
                        No questions documentation found for this run.
                    </p>
                    <p class="text-xs text-gray-400 mt-2">Expected file: ${filename}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load questions:', error);
        container.innerHTML = `
            <div class="text-center py-12">
                <p class="text-red-500">Failed to load questions.</p>
            </div>
        `;
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
    const match = fullName.match(/^(A\d+(?:\.\d+)?)/i);
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
            nestedFieldSeparator: false,
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
            formatter: (cell) => {
                const value = cell.getValue();
                const isStarred = STARRED_QUESTIONS.includes(value);
                if (isStarred) {
                    const el = cell.getElement();
                    el.classList.add('question-highlight');
                    el.setAttribute('title', 'This question is published');
                    return `<span class="question-index">${value}⭐</span>`;
                }
                return `<span class="question-index">${value}</span>`;
            }
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
        nestedFieldSeparator: false,
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
