let allData = [];
const CACHE_KEY = 'watchlistData';
const CACHE_HEADERS_KEY = 'watchlistHeaders';
const API_BASE_URL = 'http://localhost:3000/api';

// Get cached data
function getCachedData() {
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedHeaders = localStorage.getItem(CACHE_HEADERS_KEY);
    
    if (cachedData && cachedHeaders) {
        return {
            headers: JSON.parse(cachedHeaders),
            data: JSON.parse(cachedData)
        };
    }
    return null;
}

// Save data to cache
function saveToCache(headers, data) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_HEADERS_KEY, JSON.stringify(headers));
}

// Save data to SQLite database
async function saveToDatabase(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/save-watchlist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: data })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to save to database');
        }
        
        return result;
    } catch (error) {
        console.error('Error saving to database:', error);
        throw error;
    }
}

// Load data from SQLite database
async function loadFromDatabase() {
    try {
        const response = await fetch(`${API_BASE_URL}/load-watchlist`);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to load from database');
        }
        
        return result.data;
    } catch (error) {
        console.error('Error loading from database:', error);
        throw error;
    }
}

// Get database info
async function getDatabaseInfo() {
    try {
        const response = await fetch(`${API_BASE_URL}/db-info`);
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error getting database info:', error);
        return null;
    }
}

// Clear cache
function clearCache() {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_HEADERS_KEY);
    allData = [];
    document.getElementById('tableBody').innerHTML = '';
    document.getElementById('headerRow').innerHTML = '';
    document.getElementById('csvFile').value = '';
    alert('Cache cleared! Please select a CSV file to load.');
}

// Display current date
function displayCurrentDate() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const year = today.getFullYear();
    const dateString = `${month}/${day}/${year}`;
    
    // Get weekday name
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekday = weekdays[today.getDay()];
    
    document.getElementById('currentDate').textContent = `${dateString} - ${weekday}`;
}

// Parse CSV data
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',');
    
    // Ensure Comment column exists
    if (!headers.includes('Comment')) {
        headers.push('Comment');
    }
    
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, index) => {
            row[header.trim()] = values[index] ? values[index].trim() : '';
        });
        data.push(row);
    }

    return { headers, data };
}

// Load and display CSV
async function loadCSV() {
    try {
        const response = await fetch('watchlist.csv');
        const csvText = await response.text();
        const { headers, data } = parseCSV(csvText);
        
        allData = data;
        populateTable(headers, data);
    } catch (error) {
        console.error('Error loading CSV:', error);
        document.getElementById('tableBody').innerHTML = 
            '<tr><td colspan="10">Please select a CSV file to load</td></tr>';
    }
}

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csvText = e.target.result;
            const { headers, data } = parseCSV(csvText);
            
            allData = data;
            saveToCache(headers, data);
            populateTable(headers, data);
        } catch (error) {
            console.error('Error parsing CSV:', error);
            document.getElementById('tableBody').innerHTML = 
                '<tr><td colspan="10">Error parsing CSV file</td></tr>';
        }
    };
    reader.readAsText(file);
}

// Sort data by category (Index ETFs, Sector ETFs, then others)
function sortByCategory(data) {
    const indexETFs = ['SPY', 'QQQ', 'VOO', 'TQQQ'];
    const sectorETFs = ['XLF', 'XLE', 'XLI', 'XLU', 'XLV', 'XLP', 'XLY', 'XLC', 'XLK', 'XLRE'];
    
    const sorted = [...data].sort((a, b) => {
        const symbolA = a.Symbol?.toUpperCase() || '';
        const symbolB = b.Symbol?.toUpperCase() || '';
        
        const aIsIndexETF = indexETFs.includes(symbolA);
        const bIsIndexETF = indexETFs.includes(symbolB);
        const aIsSectorETF = sectorETFs.includes(symbolA);
        const bIsSectorETF = sectorETFs.includes(symbolB);
        
        // Index ETFs first
        if (aIsIndexETF && !bIsIndexETF) return -1;
        if (!aIsIndexETF && bIsIndexETF) return 1;
        
        // Sector ETFs second
        if (aIsSectorETF && !bIsSectorETF) return -1;
        if (!aIsSectorETF && bIsSectorETF) return 1;
        
        // Maintain original order within same category
        return 0;
    });
    
    return sorted;
}

// Helper function to update symbol preview row (called by event listeners)
function updateSymbolPreview(symbol, row) {
    const previewRow = document.querySelector(`#tableBody tr[data-symbol="${CSS.escape(symbol)}"][data-ispreview="true"]`);
    if (!previewRow) return;
    
    const previewCell = previewRow.querySelector('td');
    if (!previewCell) return;
    
    const buildTimeframePreview = (prefix) => {
        const selKey = prefix === '' ? 'Daily' : prefix;
        const selectVal = (row[selKey] || '').toString().trim();
        const selDisplay = selectVal ? (selectVal.charAt(0).toUpperCase() + selectVal.slice(1)) : 'Unselected';
        
        const emaFields = ['Bull', 'Bear', 'Tumbling'].map(trend => {
            const field = prefix === '' ? `MacroTrend${trend}` : `${prefix}MacroTrend${trend}`;
            return row[field] === true || row[field] === 'true' ? trend.toLowerCase() : null;
        }).filter(Boolean);
        const emaDisplay = emaFields.length ? emaFields.join(', ') : 'Unselected';
        
        const smaFields = ['Bull', 'Bear', 'Tumbling'].map(trend => {
            const field = prefix === '' ? `SMA200${trend}` : `${prefix}SMA200${trend}`;
            return row[field] === true || row[field] === 'true' ? trend.toLowerCase() : null;
        }).filter(Boolean);
        const smaDisplay = smaFields.length ? smaFields.join(', ') : 'Unselected';
        
        return `${selDisplay} / EMA: ${emaDisplay} / SMA: ${smaDisplay}`;
    };
    
    const dailyPreview = buildTimeframePreview('');
    const weeklyPreview = buildTimeframePreview('Weekly');
    const monthlyPreview = buildTimeframePreview('Monthly');
    previewCell.textContent = `Daily: ${dailyPreview}  |  Weekly: ${weeklyPreview}  |  Monthly: ${monthlyPreview}`;
}

// Populate table with data
function populateTable(headers, data) {
    const headerRow = document.getElementById('headerRow');
    const tableBody = document.getElementById('tableBody');

    // Clear existing content
    headerRow.innerHTML = '';
    tableBody.innerHTML = '';
    
    // Sort data by category
    const sortedData = sortByCategory(data);

    // Filter out Comment column from headers and remove Daily/Weekly/Monthly/Skip from main display
    const displayHeaders = headers.filter(h => h !== 'Comment' && h !== 'Daily' && h !== 'Weekly' && h !== 'Monthly' && h !== 'Skip');

    // Add headers
    displayHeaders.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    
    // Add Actions header
    const skipTh = document.createElement('th');
    skipTh.textContent = 'Actions';
    skipTh.style.textAlign = 'center';
    headerRow.appendChild(skipTh);

    // Add rows
    if (sortedData.length === 0) {
        document.getElementById('noResults').style.display = 'block';
        return;
    }

    document.getElementById('noResults').style.display = 'none';
    sortedData.forEach((row, rowIndex) => {
        // Initialize Skip to 'true' by default if not set
        if (!row['Skip']) {
            row['Skip'] = 'true';
        }
        
        const tr = document.createElement('tr');
        // attach symbol for reliable lookup when highlighting
        tr.dataset.symbol = row['Symbol'] || '';
        displayHeaders.forEach((header, colIndex) => {
            const td = document.createElement('td');
            
            if (header === 'Skip') {
                // Skip is now handled in the Daily/Weekly/Monthly row
            } else {
                td.textContent = row[header] || '';
            }
            
            tr.appendChild(td);
        });
        
        // Add Skip checkbox to the main row at the end
        const skipTd = document.createElement('td');
        skipTd.style.textAlign = 'center';
        skipTd.style.verticalAlign = 'middle';
        
        const skipCheckbox = document.createElement('input');
        skipCheckbox.type = 'checkbox';
        skipCheckbox.style.cursor = 'pointer';
        skipCheckbox.checked = row['Skip'] === 'true' || row['Skip'] === true;
        
        skipCheckbox.addEventListener('change', (e) => {
            row['Skip'] = e.target.checked.toString();
            saveToCache(headers, allData);
            
            // Disable/enable inputs in the daily, weekly, monthly rows
            const allRows = [dailyRow, weeklyRow, monthlyRow];
            allRows.forEach(rowElement => {
                const dwInputs = rowElement.querySelectorAll('select, button');
                dwInputs.forEach(input => {
                    input.disabled = e.target.checked;
                });
                // Also disable/enable Macro Trend checkboxes
                const macroCheckboxes = rowElement.querySelectorAll('input[type="checkbox"]');
                macroCheckboxes.forEach(checkbox => {
                    checkbox.disabled = e.target.checked;
                });
            });
            
            // Also disable/enable in the comment row
            if (monthlyRow && monthlyRow.nextElementSibling) {
                const commentRow = monthlyRow.nextElementSibling.nextElementSibling;
                if (commentRow && commentRow.classList.contains('comment-row')) {
                    const commentInputs = commentRow.querySelectorAll('button, textarea');
                    commentInputs.forEach(input => {
                        input.disabled = e.target.checked;
                    });
                }
            }
            
            // Only remove highlighting from the main row, don't re-validate others
            if (e.target.checked) {
                tr.classList.remove('incomplete-row');
            } else {
                highlightIncompleteRows();
            }
        });
        
        // Disable inputs if Skip is already checked
        if (skipCheckbox.checked) {
            setTimeout(() => {
                const allRows = [dailyRow, weeklyRow, monthlyRow];
                allRows.forEach(rowElement => {
                    const dwInputs = rowElement.querySelectorAll('select, button');
                    dwInputs.forEach(input => {
                        input.disabled = true;
                    });
                // Also disable Macro Trend checkboxes
                    const macroCheckboxes = rowElement.querySelectorAll('input[type="checkbox"]');
                    macroCheckboxes.forEach(checkbox => {
                        checkbox.disabled = true;
                    });
                });
                
                // Find comment row safely
                if (monthlyRow && monthlyRow.nextElementSibling) {
                    const commentRow = monthlyRow.nextElementSibling.nextElementSibling;
                    if (commentRow && commentRow.classList.contains('comment-row')) {
                        const commentInputs = commentRow.querySelectorAll('button, textarea');
                        commentInputs.forEach(input => {
                            input.disabled = true;
                        });
                    }
                }
            }, 0);
        }
        
        skipTd.appendChild(skipCheckbox);
        
        // Add collapse/expand button for daily, weekly, monthly rows
        const collapseBtn = document.createElement('button');
        collapseBtn.textContent = '▶';
        collapseBtn.style.marginLeft = '12px';
        collapseBtn.style.padding = '4px 8px';
        collapseBtn.style.background = 'none';
        collapseBtn.style.border = 'none';
        collapseBtn.style.cursor = 'pointer';
        collapseBtn.style.fontSize = '14px';
        collapseBtn.style.color = '#666';
        collapseBtn.title = 'Hide/Show Daily, Weekly, Monthly sections';
        
        collapseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = dailyRow.style.display === 'none';
            dailyRow.style.display = isHidden ? '' : 'none';
            weeklyRow.style.display = isHidden ? '' : 'none';
            monthlyRow.style.display = isHidden ? '' : 'none';
            
            // Also hide/show the comment row if it exists
            if (monthlyRow && monthlyRow.nextElementSibling) {
                const commentRow = monthlyRow.nextElementSibling.nextElementSibling;
                if (commentRow && commentRow.classList.contains('comment-row')) {
                    commentRow.style.display = isHidden ? '' : 'none';
                }
            }
            
            collapseBtn.textContent = isHidden ? '▼' : '▶';
        });
        
        skipTd.appendChild(collapseBtn);
        tr.appendChild(skipTd);
        
        tableBody.appendChild(tr);
        
        // Add preview row for selected values (visible only when not skipped)
        const previewRow = document.createElement('tr');
        previewRow.className = 'preview-row';
        previewRow.dataset.symbol = row['Symbol'];
        previewRow.dataset.ispreview = 'true';
        previewRow.style.backgroundColor = '#fbfbfb';
        previewRow.style.display = skipCheckbox.checked ? 'none' : '';
        
        const previewCell = document.createElement('td');
        previewCell.setAttribute('colspan', displayHeaders.length + 1);
        previewCell.style.padding = '6px 12px';
        previewCell.style.fontSize = '13px';
        previewCell.style.color = '#444';
        previewCell.style.borderTop = '1px solid #eee';
        
        previewRow.appendChild(previewCell);
        tableBody.appendChild(previewRow);
        
        // Initialize preview text
        updateSymbolPreview(row['Symbol'], row);
        
        // Update preview on skip checkbox change
        skipCheckbox.addEventListener('change', (e) => {
            previewRow.style.display = e.target.checked ? 'none' : '';
        });
        
        // Add Daily row below symbol row
        const dailyRow = document.createElement('tr');
        dailyRow.className = 'daily-weekly-row';
        dailyRow.style.display = 'none';
        const dailyCell = document.createElement('td');
        dailyCell.className = 'daily-weekly-cell-full';
        dailyCell.setAttribute('colspan', displayHeaders.length + 1);
        dailyCell.style.padding = '8px 12px';
        dailyCell.style.backgroundColor = '#f0f7ff';
        dailyCell.style.borderTop = 'none';
        
        const dailyContainer = document.createElement('div');
        dailyContainer.style.display = 'flex';
        dailyContainer.style.flexDirection = 'column';
        dailyContainer.style.alignItems = 'flex-start';
        dailyContainer.style.gap = '4px';
        
        const dailyLabel = document.createElement('label');
        dailyLabel.style.display = 'flex';
        dailyLabel.style.flexDirection = 'column';
        dailyLabel.style.alignItems = 'flex-start';
        dailyLabel.style.gap = '4px';
        dailyLabel.style.fontWeight = 'bold';
        dailyLabel.style.fontSize = '13px';
        dailyLabel.textContent = 'Daily:';
        
        const dailySelect = document.createElement('select');
        dailySelect.style.padding = '6px';
        dailySelect.style.borderRadius = '4px';
        dailySelect.style.border = '1px solid #ddd';
        dailySelect.style.cursor = 'pointer';
        
        const dailyOptions = ['', 'Buy', 'Sell', 'Neutral'];
        dailyOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.toLowerCase();
            option.textContent = opt || '- Select -';
            dailySelect.appendChild(option);
        });
        
        dailySelect.value = row['Daily'].toLowerCase();
        
        dailySelect.addEventListener('change', (e) => {
            row['Daily'] = e.target.value;
            saveToCache(headers, allData);
            highlightIncompleteRows();
            updateSymbolPreview(row['Symbol'], row);
        });
        
        dailyLabel.appendChild(dailySelect);
        
        // Add Daily collapse button
        const dailyToggle = document.createElement('button');
        dailyToggle.textContent = '▼ Hide';
        dailyToggle.style.marginLeft = '8px';
        dailyToggle.style.padding = '4px 8px';
        dailyToggle.style.background = 'none';
        dailyToggle.style.border = 'none';
        dailyToggle.style.cursor = 'pointer';
        dailyToggle.style.fontSize = '12px';
        dailyToggle.style.color = '#666';
        dailyLabel.style.display = 'flex';
        dailyLabel.style.justifyContent = 'space-between';
        dailyLabel.style.alignItems = 'center';
        dailyLabel.appendChild(dailyToggle);
        
        dailyContainer.appendChild(dailyLabel);
        
        // Add Macro Trend section with checkboxes
        const macroTrendDiv = document.createElement('div');
        macroTrendDiv.style.display = 'flex';
        macroTrendDiv.style.flexDirection = 'column';
        macroTrendDiv.style.gap = '6px';
        macroTrendDiv.style.marginTop = '4px';
        
        const macroLabel = document.createElement('label');
        macroLabel.style.fontWeight = 'bold';
        macroLabel.style.fontSize = '12px';
        macroLabel.textContent = 'Macro Trend';
        macroTrendDiv.appendChild(macroLabel);
        
        const macroCheckboxesRow = document.createElement('div');
        macroCheckboxesRow.style.display = 'flex';
        macroCheckboxesRow.style.alignItems = 'center';
        macroCheckboxesRow.style.gap = '12px';
        
        const emaLabel = document.createElement('label');
        emaLabel.style.fontWeight = 'normal';
        emaLabel.style.fontSize = '11px';
        emaLabel.style.margin = '0';
        emaLabel.textContent = 'EMA(50,125)';
        macroCheckboxesRow.appendChild(emaLabel);
        
        const emaTooltip = document.createElement('span');
        emaTooltip.textContent = '?';
        emaTooltip.style.fontSize = '14px';
        emaTooltip.style.fontWeight = 'bold';
        emaTooltip.style.cursor = 'help';
        emaTooltip.style.marginLeft = '4px';
        emaTooltip.style.color = '#0066cc';
        emaTooltip.style.display = 'inline-block';
        emaTooltip.title = 'Daily chart first, 4H chart second';
        macroCheckboxesRow.appendChild(emaTooltip);
        
        const trendOptions = ['Bull', 'Bear', 'Tumbling'];
        trendOptions.forEach(trend => {
            const checkboxWrapper = document.createElement('label');
            checkboxWrapper.style.display = 'flex';
            checkboxWrapper.style.alignItems = 'center';
            checkboxWrapper.style.gap = '4px';
            checkboxWrapper.style.fontSize = '12px';
            checkboxWrapper.style.cursor = 'pointer';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = trend.toLowerCase();
            checkbox.checked = row[`MacroTrend${trend}`] === 'true' || row[`MacroTrend${trend}`] === true;
            
            checkbox.addEventListener('change', (e) => {
                row[`MacroTrend${trend}`] = e.target.checked;
                saveToCache(headers, allData);
                updateSymbolPreview(row['Symbol'], row);
            });
            
            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(document.createTextNode(trend));
            macroCheckboxesRow.appendChild(checkboxWrapper);
        });
        
        macroTrendDiv.appendChild(macroCheckboxesRow);
        dailyContainer.appendChild(macroTrendDiv);
        
        // Add SMA(200) section with checkboxes
        const sma200Div = document.createElement('div');
        sma200Div.style.display = 'flex';
        sma200Div.style.flexDirection = 'column';
        sma200Div.style.gap = '6px';
        sma200Div.style.marginTop = '4px';
        
        const smaLabel = document.createElement('label');
        smaLabel.style.fontWeight = 'normal';
        smaLabel.style.fontSize = '12px';
        smaLabel.style.display = 'none';
        sma200Div.appendChild(smaLabel);
        
        const sma200CheckboxesRow = document.createElement('div');
        sma200CheckboxesRow.style.display = 'flex';
        sma200CheckboxesRow.style.alignItems = 'center';
        sma200CheckboxesRow.style.gap = '12px';
        
        const sma200Label = document.createElement('label');
        sma200Label.style.fontWeight = 'normal';
        sma200Label.style.fontSize = '11px';
        sma200Label.style.margin = '0';
        sma200Label.textContent = 'SMA(200)';
        sma200CheckboxesRow.appendChild(sma200Label);
        
        const sma200Tooltip = document.createElement('span');
        sma200Tooltip.textContent = '?';
        sma200Tooltip.style.fontSize = '14px';
        sma200Tooltip.style.fontWeight = 'bold';
        sma200Tooltip.style.cursor = 'help';
        sma200Tooltip.style.marginLeft = '4px';
        sma200Tooltip.style.color = '#0066cc';
        sma200Tooltip.style.display = 'inline-block';
        sma200Tooltip.title = 'Daily (1D) – the gold standard and Weekly (1W) – macro & "big money" view';
        sma200CheckboxesRow.appendChild(sma200Tooltip);
        const sma200Options = ['Bull', 'Bear', 'Tumbling'];
        sma200Options.forEach(trend => {
            const checkboxWrapper = document.createElement('label');
            checkboxWrapper.style.display = 'flex';
            checkboxWrapper.style.alignItems = 'center';
            checkboxWrapper.style.gap = '4px';
            checkboxWrapper.style.fontSize = '12px';
            checkboxWrapper.style.cursor = 'pointer';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = trend.toLowerCase();
            checkbox.checked = row[`SMA200${trend}`] === 'true' || row[`SMA200${trend}`] === true;
            
            checkbox.addEventListener('change', (e) => {
                row[`SMA200${trend}`] = e.target.checked;
                saveToCache(headers, allData);
                updateSymbolPreview(row['Symbol'], row);
            });
            
            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(document.createTextNode(trend));
            sma200CheckboxesRow.appendChild(checkboxWrapper);
        });
        
        sma200Div.appendChild(sma200CheckboxesRow);
        dailyContainer.appendChild(sma200Div);
        
        // Add Daily editor
        const dailyEditorId = `daily-editor-${row['Symbol']}`;
        const dailyEditorContainer = document.createElement('div');
        dailyEditorContainer.className = 'daily-editor-container';
        dailyEditorContainer.id = `daily-editor-container-${row['Symbol']}`;
        dailyEditorContainer.style.display = 'block';
        dailyEditorContainer.style.marginTop = '8px';
        
        const dailyEditor = document.createElement('div');
        dailyEditor.id = dailyEditorId;
        dailyEditorContainer.appendChild(dailyEditor);
        dailyContainer.appendChild(dailyEditorContainer);
        
        dailyToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = dailyEditorContainer.style.display === 'none';
            dailyEditorContainer.style.display = isHidden ? 'block' : 'none';
            dailyToggle.textContent = isHidden ? '▼ Hide' : '▶ Show';
        });
        
        dailyCell.appendChild(dailyContainer);
        dailyRow.appendChild(dailyCell);
        tableBody.appendChild(dailyRow);
        
        // Store Quill instance for later reference
        if (!window.quillEditors) window.quillEditors = {};
        
        // Initialize Quill editor for Daily with image support
        setTimeout(() => {
            const dailyQuill = new Quill(`#${dailyEditorId}`, {
                theme: 'snow',
                modules: {
                    toolbar: [
                        ['bold', 'italic', 'underline'],
                        ['image'],
                        ['list'],
                    ]
                },
                placeholder: 'Enter daily notes with images...'
            });
            
            dailyQuill.root.innerHTML = row['DailyNotes'] || '';
            window.quillEditors[`daily-${row['Symbol']}`] = dailyQuill;
            
            dailyQuill.on('text-change', () => {
                row['DailyNotes'] = dailyQuill.root.innerHTML;
                saveToCache(headers, allData);
            });
        }, 0);
        
        // Add Weekly row
        const weeklyRow = document.createElement('tr');
        weeklyRow.className = 'daily-weekly-row';
        weeklyRow.style.display = 'none';
        const weeklyCell = document.createElement('td');
        weeklyCell.className = 'daily-weekly-cell-full';
        weeklyCell.setAttribute('colspan', displayHeaders.length + 1);
        weeklyCell.style.padding = '8px 12px';
        weeklyCell.style.backgroundColor = '#f0f7ff';
        weeklyCell.style.borderTop = 'none';
        
        const weeklyContainer = document.createElement('div');
        weeklyContainer.style.display = 'flex';
        weeklyContainer.style.flexDirection = 'column';
        weeklyContainer.style.alignItems = 'flex-start';
        weeklyContainer.style.gap = '4px';
        
        const weeklyLabel = document.createElement('label');
        weeklyLabel.style.display = 'flex';
        weeklyLabel.style.flexDirection = 'column';
        weeklyLabel.style.alignItems = 'flex-start';
        weeklyLabel.style.gap = '4px';
        weeklyLabel.style.fontWeight = 'bold';
        weeklyLabel.style.fontSize = '13px';
        weeklyLabel.textContent = 'Weekly:';
        
        const weeklySelect = document.createElement('select');
        weeklySelect.style.padding = '6px';
        weeklySelect.style.borderRadius = '4px';
        weeklySelect.style.border = '1px solid #ddd';
        weeklySelect.style.cursor = 'pointer';
        
        const weeklyOptions = ['', 'Buy', 'Sell', 'Neutral'];
        weeklyOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.toLowerCase();
            option.textContent = opt || '- Select -';
            weeklySelect.appendChild(option);
        });
        
        weeklySelect.value = row['Weekly'].toLowerCase();
        
        weeklySelect.addEventListener('change', (e) => {
            row['Weekly'] = e.target.value;
            saveToCache(headers, allData);
            highlightIncompleteRows();
            updateSymbolPreview(row['Symbol'], row);
        });
        
        weeklyLabel.appendChild(weeklySelect);
        
        // Add Weekly collapse button
        const weeklyToggle = document.createElement('button');
        weeklyToggle.textContent = '▼ Hide';
        weeklyToggle.style.marginLeft = '8px';
        weeklyToggle.style.padding = '4px 8px';
        weeklyToggle.style.background = 'none';
        weeklyToggle.style.border = 'none';
        weeklyToggle.style.cursor = 'pointer';
        weeklyToggle.style.fontSize = '12px';
        weeklyToggle.style.color = '#666';
        weeklyLabel.style.display = 'flex';
        weeklyLabel.style.justifyContent = 'space-between';
        weeklyLabel.style.alignItems = 'center';
        weeklyLabel.appendChild(weeklyToggle);
        
        weeklyContainer.appendChild(weeklyLabel);
        
        // Add Macro Trend section with checkboxes
        const weeklyMacroTrendDiv = document.createElement('div');
        weeklyMacroTrendDiv.style.display = 'flex';
        weeklyMacroTrendDiv.style.flexDirection = 'column';
        weeklyMacroTrendDiv.style.gap = '6px';
        weeklyMacroTrendDiv.style.marginTop = '4px';
        
        const weeklyMacroLabel = document.createElement('label');
        weeklyMacroLabel.style.fontWeight = 'bold';
        weeklyMacroLabel.style.fontSize = '12px';
        weeklyMacroLabel.textContent = 'Macro Trend';
        weeklyMacroTrendDiv.appendChild(weeklyMacroLabel);
        
        const weeklyMacroCheckboxesRow = document.createElement('div');
        weeklyMacroCheckboxesRow.style.display = 'flex';
        weeklyMacroCheckboxesRow.style.alignItems = 'center';
        weeklyMacroCheckboxesRow.style.gap = '12px';
        
        const weeklyEmaLabel = document.createElement('label');
        weeklyEmaLabel.style.fontWeight = 'normal';
        weeklyEmaLabel.style.fontSize = '11px';
        weeklyEmaLabel.style.margin = '0';
        weeklyEmaLabel.textContent = 'EMA(50,125)';
        weeklyMacroCheckboxesRow.appendChild(weeklyEmaLabel);
        
        const weeklyEmaTooltip = document.createElement('span');
        weeklyEmaTooltip.textContent = '?';
        weeklyEmaTooltip.style.fontSize = '14px';
        weeklyEmaTooltip.style.fontWeight = 'bold';
        weeklyEmaTooltip.style.cursor = 'help';
        weeklyEmaTooltip.style.marginLeft = '4px';
        weeklyEmaTooltip.style.color = '#0066cc';
        weeklyEmaTooltip.style.display = 'inline-block';
        weeklyEmaTooltip.title = 'Daily chart first, 4H chart second';
        weeklyMacroCheckboxesRow.appendChild(weeklyEmaTooltip);
        
        const weeklyTrendOptions = ['Bull', 'Bear', 'Tumbling'];
        weeklyTrendOptions.forEach(trend => {
            const checkboxWrapper = document.createElement('label');
            checkboxWrapper.style.display = 'flex';
            checkboxWrapper.style.alignItems = 'center';
            checkboxWrapper.style.gap = '4px';
            checkboxWrapper.style.fontSize = '12px';
            checkboxWrapper.style.cursor = 'pointer';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = trend.toLowerCase();
            checkbox.checked = row[`WeeklyMacroTrend${trend}`] === 'true' || row[`WeeklyMacroTrend${trend}`] === true;
            
            checkbox.addEventListener('change', (e) => {
                row[`WeeklyMacroTrend${trend}`] = e.target.checked;
                saveToCache(headers, allData);
                updateSymbolPreview(row['Symbol'], row);
            });
            
            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(document.createTextNode(trend));
            weeklyMacroCheckboxesRow.appendChild(checkboxWrapper);
        });
        
        weeklyMacroTrendDiv.appendChild(weeklyMacroCheckboxesRow);
        weeklyContainer.appendChild(weeklyMacroTrendDiv);
        
        // Add SMA(200) section with checkboxes
        const weeklySma200Div = document.createElement('div');
        weeklySma200Div.style.display = 'flex';
        weeklySma200Div.style.flexDirection = 'column';
        weeklySma200Div.style.gap = '6px';
        weeklySma200Div.style.marginTop = '4px';
        
        const weeklySmaLabel = document.createElement('label');
        weeklySmaLabel.style.fontWeight = 'normal';
        weeklySmaLabel.style.fontSize = '12px';
        weeklySmaLabel.style.display = 'none';
        weeklySma200Div.appendChild(weeklySmaLabel);
        
        const weeklySma200CheckboxesRow = document.createElement('div');
        weeklySma200CheckboxesRow.style.display = 'flex';
        weeklySma200CheckboxesRow.style.alignItems = 'center';
        weeklySma200CheckboxesRow.style.gap = '12px';
        
        const weeklySma200LabelInRow = document.createElement('label');
        weeklySma200LabelInRow.style.fontWeight = 'normal';
        weeklySma200LabelInRow.style.fontSize = '11px';
        weeklySma200LabelInRow.style.margin = '0';
        weeklySma200LabelInRow.textContent = 'SMA(200)';
        weeklySma200CheckboxesRow.appendChild(weeklySma200LabelInRow);
        
        const weeklySma200Tooltip = document.createElement('span');
        weeklySma200Tooltip.textContent = '?';
        weeklySma200Tooltip.style.fontSize = '14px';
        weeklySma200Tooltip.style.fontWeight = 'bold';
        weeklySma200Tooltip.style.cursor = 'help';
        weeklySma200Tooltip.style.marginLeft = '4px';
        weeklySma200Tooltip.style.color = '#0066cc';
        weeklySma200Tooltip.style.display = 'inline-block';
        weeklySma200Tooltip.title = 'Daily (1D) – the gold standard and Weekly (1W) – macro & "big money" view';
        weeklySma200CheckboxesRow.appendChild(weeklySma200Tooltip);
        
        const weeklySma200Options = ['Bull', 'Bear', 'Tumbling'];
        weeklySma200Options.forEach(trend => {
            const checkboxWrapper = document.createElement('label');
            checkboxWrapper.style.display = 'flex';
            checkboxWrapper.style.alignItems = 'center';
            checkboxWrapper.style.gap = '4px';
            checkboxWrapper.style.fontSize = '12px';
            checkboxWrapper.style.cursor = 'pointer';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = trend.toLowerCase();
            checkbox.checked = row[`WeeklySMA200${trend}`] === 'true' || row[`WeeklySMA200${trend}`] === true;
            
            checkbox.addEventListener('change', (e) => {
                row[`WeeklySMA200${trend}`] = e.target.checked;
                saveToCache(headers, allData);
                updateSymbolPreview(row['Symbol'], row);
            });
            
            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(document.createTextNode(trend));
            weeklySma200CheckboxesRow.appendChild(checkboxWrapper);
        });
        
        weeklySma200Div.appendChild(weeklySma200CheckboxesRow);
        weeklyContainer.appendChild(weeklySma200Div);
        
        // Add Weekly editor
        const weeklyEditorId = `weekly-editor-${row['Symbol']}`;
        const weeklyEditorContainer = document.createElement('div');
        weeklyEditorContainer.className = 'daily-editor-container';
        weeklyEditorContainer.id = `weekly-editor-container-${row['Symbol']}`;
        weeklyEditorContainer.style.display = 'block';
        weeklyEditorContainer.style.marginTop = '8px';
        
        const weeklyEditor = document.createElement('div');
        weeklyEditor.id = weeklyEditorId;
        weeklyEditorContainer.appendChild(weeklyEditor);
        weeklyContainer.appendChild(weeklyEditorContainer);
        
        weeklyToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = weeklyEditorContainer.style.display === 'none';
            weeklyEditorContainer.style.display = isHidden ? 'block' : 'none';
            weeklyToggle.textContent = isHidden ? '▼ Hide' : '▶ Show';
        });
        
        weeklyCell.appendChild(weeklyContainer);
        weeklyRow.appendChild(weeklyCell);
        tableBody.appendChild(weeklyRow);
        
        // Initialize Quill editor for Weekly with image support
        setTimeout(() => {
            const weeklyQuill = new Quill(`#${weeklyEditorId}`, {
                theme: 'snow',
                modules: {
                    toolbar: [
                        ['bold', 'italic', 'underline'],
                        ['image'],
                        ['list'],
                    ]
                },
                placeholder: 'Enter weekly notes with images...'
            });
            
            weeklyQuill.root.innerHTML = row['WeeklyNotes'] || '';
            window.quillEditors[`weekly-${row['Symbol']}`] = weeklyQuill;
            
            weeklyQuill.on('text-change', () => {
                row['WeeklyNotes'] = weeklyQuill.root.innerHTML;
                saveToCache(headers, allData);
            });
        }, 0);
        
        // Add Monthly row
        const monthlyRow = document.createElement('tr');
        monthlyRow.className = 'daily-weekly-row';
        monthlyRow.style.display = 'none';
        const monthlyCell = document.createElement('td');
        monthlyCell.className = 'daily-weekly-cell-full';
        monthlyCell.setAttribute('colspan', displayHeaders.length + 1);
        monthlyCell.style.padding = '8px 12px';
        monthlyCell.style.backgroundColor = '#f0f7ff';
        monthlyCell.style.borderTop = 'none';
        
        const monthlyContainer = document.createElement('div');
        monthlyContainer.style.display = 'flex';
        monthlyContainer.style.flexDirection = 'column';
        monthlyContainer.style.alignItems = 'flex-start';
        monthlyContainer.style.gap = '4px';
        
        const monthlyLabel = document.createElement('label');
        monthlyLabel.style.display = 'flex';
        monthlyLabel.style.flexDirection = 'column';
        monthlyLabel.style.alignItems = 'flex-start';
        monthlyLabel.style.gap = '4px';
        monthlyLabel.style.fontWeight = 'bold';
        monthlyLabel.style.fontSize = '13px';
        monthlyLabel.textContent = 'Monthly:';
        
        const monthlySelect = document.createElement('select');
        monthlySelect.style.padding = '6px';
        monthlySelect.style.borderRadius = '4px';
        monthlySelect.style.border = '1px solid #ddd';
        monthlySelect.style.cursor = 'pointer';
        
        const monthlyOptions = ['', 'Buy', 'Sell', 'Neutral'];
        monthlyOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.toLowerCase();
            option.textContent = opt || '- Select -';
            monthlySelect.appendChild(option);
        });
        
        monthlySelect.value = row['Monthly'].toLowerCase();
        
        monthlySelect.addEventListener('change', (e) => {
            row['Monthly'] = e.target.value;
            saveToCache(headers, allData);
            highlightIncompleteRows();
            updateSymbolPreview(row['Symbol'], row);
        });
        
        monthlyLabel.appendChild(monthlySelect);
        
        // Add Monthly collapse button
        const monthlyToggle = document.createElement('button');
        monthlyToggle.textContent = '▼ Hide';
        monthlyToggle.style.marginLeft = '8px';
        monthlyToggle.style.padding = '4px 8px';
        monthlyToggle.style.background = 'none';
        monthlyToggle.style.border = 'none';
        monthlyToggle.style.cursor = 'pointer';
        monthlyToggle.style.fontSize = '12px';
        monthlyToggle.style.color = '#666';
        monthlyLabel.style.display = 'flex';
        monthlyLabel.style.justifyContent = 'space-between';
        monthlyLabel.style.alignItems = 'center';
        monthlyLabel.appendChild(monthlyToggle);
        
        monthlyContainer.appendChild(monthlyLabel);
        
        // Add Macro Trend section with checkboxes
        const monthlyMacroTrendDiv = document.createElement('div');
        monthlyMacroTrendDiv.style.display = 'flex';
        monthlyMacroTrendDiv.style.flexDirection = 'column';
        monthlyMacroTrendDiv.style.gap = '6px';
        monthlyMacroTrendDiv.style.marginTop = '4px';
        
        const monthlyMacroLabel = document.createElement('label');
        monthlyMacroLabel.style.fontWeight = 'bold';
        monthlyMacroLabel.style.fontSize = '12px';
        monthlyMacroLabel.textContent = 'Macro Trend';
        monthlyMacroTrendDiv.appendChild(monthlyMacroLabel);
        
        const monthlyMacroCheckboxesRow = document.createElement('div');
        monthlyMacroCheckboxesRow.style.display = 'flex';
        monthlyMacroCheckboxesRow.style.alignItems = 'center';
        monthlyMacroCheckboxesRow.style.gap = '12px';
        
        const monthlyEmaLabel = document.createElement('label');
        monthlyEmaLabel.style.fontWeight = 'normal';
        monthlyEmaLabel.style.fontSize = '11px';
        monthlyEmaLabel.style.margin = '0';
        monthlyEmaLabel.textContent = 'EMA(50,125)';
        monthlyMacroCheckboxesRow.appendChild(monthlyEmaLabel);
        
        const monthlyEmaTooltip = document.createElement('span');
        monthlyEmaTooltip.textContent = '?';
        monthlyEmaTooltip.style.fontSize = '14px';
        monthlyEmaTooltip.style.fontWeight = 'bold';
        monthlyEmaTooltip.style.cursor = 'help';
        monthlyEmaTooltip.style.marginLeft = '4px';
        monthlyEmaTooltip.style.color = '#0066cc';
        monthlyEmaTooltip.style.display = 'inline-block';
        monthlyEmaTooltip.title = 'Daily chart first, 4H chart second';
        monthlyMacroCheckboxesRow.appendChild(monthlyEmaTooltip);
        
        const monthlyTrendOptions = ['Bull', 'Bear', 'Tumbling'];
        monthlyTrendOptions.forEach(trend => {
            const checkboxWrapper = document.createElement('label');
            checkboxWrapper.style.display = 'flex';
            checkboxWrapper.style.alignItems = 'center';
            checkboxWrapper.style.gap = '4px';
            checkboxWrapper.style.fontSize = '12px';
            checkboxWrapper.style.cursor = 'pointer';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = trend.toLowerCase();
            checkbox.checked = row[`MonthlyMacroTrend${trend}`] === 'true' || row[`MonthlyMacroTrend${trend}`] === true;
            
            checkbox.addEventListener('change', (e) => {
                row[`MonthlyMacroTrend${trend}`] = e.target.checked;
                saveToCache(headers, allData);
                updateSymbolPreview(row['Symbol'], row);
            });
            
            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(document.createTextNode(trend));
            monthlyMacroCheckboxesRow.appendChild(checkboxWrapper);
        });
        
        monthlyMacroTrendDiv.appendChild(monthlyMacroCheckboxesRow);
        monthlyContainer.appendChild(monthlyMacroTrendDiv);
        
        // Add SMA(200) section with checkboxes
        const monthlySma200Div = document.createElement('div');
        monthlySma200Div.style.display = 'flex';
        monthlySma200Div.style.flexDirection = 'column';
        monthlySma200Div.style.gap = '6px';
        monthlySma200Div.style.marginTop = '4px';
        
        const monthlySmaLabel = document.createElement('label');
        monthlySmaLabel.style.fontWeight = 'normal';
        monthlySmaLabel.style.fontSize = '12px';
        monthlySmaLabel.style.display = 'none';
        monthlySma200Div.appendChild(monthlySmaLabel);
        
        const monthlySma200CheckboxesRow = document.createElement('div');
        monthlySma200CheckboxesRow.style.display = 'flex';
        monthlySma200CheckboxesRow.style.alignItems = 'center';
        monthlySma200CheckboxesRow.style.gap = '12px';
        
        const monthlySma200LabelInRow = document.createElement('label');
        monthlySma200LabelInRow.style.fontWeight = 'normal';
        monthlySma200LabelInRow.style.fontSize = '11px';
        monthlySma200LabelInRow.style.margin = '0';
        monthlySma200LabelInRow.textContent = 'SMA(200)';
        monthlySma200CheckboxesRow.appendChild(monthlySma200LabelInRow);
        
        const monthlySma200Tooltip = document.createElement('span');
        monthlySma200Tooltip.textContent = '?';
        monthlySma200Tooltip.style.fontSize = '14px';
        monthlySma200Tooltip.style.fontWeight = 'bold';
        monthlySma200Tooltip.style.cursor = 'help';
        monthlySma200Tooltip.style.marginLeft = '4px';
        monthlySma200Tooltip.style.color = '#0066cc';
        monthlySma200Tooltip.style.display = 'inline-block';
        monthlySma200Tooltip.title = 'Daily (1D) – the gold standard and Weekly (1W) – macro & "big money" view';
        monthlySma200CheckboxesRow.appendChild(monthlySma200Tooltip);
        
        const monthlySma200Options = ['Bull', 'Bear', 'Tumbling'];
        monthlySma200Options.forEach(trend => {
            const checkboxWrapper = document.createElement('label');
            checkboxWrapper.style.display = 'flex';
            checkboxWrapper.style.alignItems = 'center';
            checkboxWrapper.style.gap = '4px';
            checkboxWrapper.style.fontSize = '12px';
            checkboxWrapper.style.cursor = 'pointer';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = trend.toLowerCase();
            checkbox.checked = row[`MonthlySMA200${trend}`] === 'true' || row[`MonthlySMA200${trend}`] === true;
            
            checkbox.addEventListener('change', (e) => {
                row[`MonthlySMA200${trend}`] = e.target.checked;
                saveToCache(headers, allData);
                updateSymbolPreview(row['Symbol'], row);
            });
            
            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(document.createTextNode(trend));
            monthlySma200CheckboxesRow.appendChild(checkboxWrapper);
        });
        
        monthlySma200Div.appendChild(monthlySma200CheckboxesRow);
        monthlyContainer.appendChild(monthlySma200Div);
        
        // Add Monthly editor
        const monthlyEditorId = `monthly-editor-${row['Symbol']}`;
        const monthlyEditorContainer = document.createElement('div');
        monthlyEditorContainer.className = 'daily-editor-container';
        monthlyEditorContainer.id = `monthly-editor-container-${row['Symbol']}`;
        monthlyEditorContainer.style.display = 'block';
        monthlyEditorContainer.style.marginTop = '8px';
        
        const monthlyEditor = document.createElement('div');
        monthlyEditor.id = monthlyEditorId;
        monthlyEditorContainer.appendChild(monthlyEditor);
        monthlyContainer.appendChild(monthlyEditorContainer);
        
        monthlyToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = monthlyEditorContainer.style.display === 'none';
            monthlyEditorContainer.style.display = isHidden ? 'block' : 'none';
            monthlyToggle.textContent = isHidden ? '▼ Hide' : '▶ Show';
        });
        
        monthlyCell.appendChild(monthlyContainer);
        monthlyRow.appendChild(monthlyCell);
        tableBody.appendChild(monthlyRow);
        
        // Initialize Quill editor for Monthly with image support
        setTimeout(() => {
            const monthlyQuill = new Quill(`#${monthlyEditorId}`, {
                theme: 'snow',
                modules: {
                    toolbar: [
                        ['bold', 'italic', 'underline'],
                        ['image'],
                        ['list'],
                    ]
                },
                placeholder: 'Enter monthly notes with images...'
            });
            
            monthlyQuill.root.innerHTML = row['MonthlyNotes'] || '';
            window.quillEditors[`monthly-${row['Symbol']}`] = monthlyQuill;
            
            monthlyQuill.on('text-change', () => {
                row['MonthlyNotes'] = monthlyQuill.root.innerHTML;
                saveToCache(headers, allData);
            });
        }, 0);
        

    });
}

// Validate required fields
function validateData() {
    const requiredColumns = ['Daily', 'Weekly', 'Monthly'];
    const incompleteRows = [];
    
    allData.forEach((row, index) => {
        // Skip validation if Skip is checked
        if (row['Skip'] === 'true' || row['Skip'] === true) {
            return;
        }
        
        requiredColumns.forEach(col => {
            if (!row[col] || row[col].trim() === '') {
                incompleteRows.push({
                    symbol: row['Symbol'],
                    column: col,
                    rowIndex: index,
                    type: 'missing-selection'
                });
            }
        });
        
        // Validate Macro Trend checkboxes for Daily
        const dailyMacroTrends = ['MacroTrendBull', 'MacroTrendBear', 'MacroTrendTumbling'];
        const hasDailyMacroTrend = dailyMacroTrends.some(trend => row[trend] === 'true' || row[trend] === true);
        if (!hasDailyMacroTrend && (row['Daily'] && row['Daily'].trim() !== '')) {
            incompleteRows.push({
                symbol: row['Symbol'],
                column: 'Daily Macro Trend',
                rowIndex: index,
                type: 'macro-trend'
            });
        }
        
        // Validate Macro Trend checkboxes for Weekly
        const weeklyMacroTrends = ['WeeklyMacroTrendBull', 'WeeklyMacroTrendBear', 'WeeklyMacroTrendTumbling'];
        const hasWeeklyMacroTrend = weeklyMacroTrends.some(trend => row[trend] === 'true' || row[trend] === true);
        if (!hasWeeklyMacroTrend && (row['Weekly'] && row['Weekly'].trim() !== '')) {
            incompleteRows.push({
                symbol: row['Symbol'],
                column: 'Weekly Macro Trend',
                rowIndex: index,
                type: 'macro-trend'
            });
        }
    });
    
    return incompleteRows;
}

// Highlight incomplete rows
function highlightIncompleteRows() {
    const incomplete = validateData();
    const tableRows = document.querySelectorAll('#tableBody tr:not(.daily-weekly-row):not(.comment-row)');
    
    tableRows.forEach(row => {
        row.classList.remove('incomplete-row');
    });
    
    incomplete.forEach(item => {
        // Find the row by its symbol data attribute to avoid index mismatches
        if (!item || !item.symbol) return;
        const selector = `#tableBody tr[data-symbol="${CSS.escape(item.symbol)}"]`;
        const target = document.querySelector(selector);
        if (target) {
            target.classList.add('incomplete-row');
        }
    });
    
    return incomplete;
}

// Filter table based on search input with wildcard support and dropdown filters
function filterTable(searchTerm) {
    const dailyFilterValue = document.getElementById('dailyFilter').value;
    const weeklyFilterValue = document.getElementById('weeklyFilter').value;
    const monthlyFilterValue = document.getElementById('monthlyFilter').value;
    
    if (!searchTerm.trim() && !dailyFilterValue && !weeklyFilterValue && !monthlyFilterValue) {
        const headers = Object.keys(allData[0] || {});
        populateTable(headers, allData);
        highlightIncompleteRows();
        return;
    }
    
    const headers = Object.keys(allData[0] || {});
    
    // Convert wildcard pattern to regex
    let regexPattern = searchTerm
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex characters
        .replace(/\*/g, '.*'); // Replace * with regex wildcard
    
    const regex = new RegExp('^' + regexPattern + '$', 'i'); // Case-insensitive exact match with wildcards
    
    const filteredData = allData.filter(row => {
        // Check search term match
        const matchesSearch = !searchTerm.trim() || headers.some(header => 
            regex.test(row[header])
        );
        
        // Check Daily filter
        const matchesDaily = !dailyFilterValue || (row['Daily'] || '').toLowerCase() === dailyFilterValue;
        
        // Check Weekly filter
        const matchesWeekly = !weeklyFilterValue || (row['Weekly'] || '').toLowerCase() === weeklyFilterValue;
        
        // Check Monthly filter
        const matchesMonthly = !monthlyFilterValue || (row['Monthly'] || '').toLowerCase() === monthlyFilterValue;
        
        return matchesSearch && matchesDaily && matchesWeekly && matchesMonthly;
    });

    populateTable(headers, filteredData);
    highlightIncompleteRows();
}

// Event listener for search input with autocomplete
document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value;
    filterTable(searchTerm);
    updateSuggestions(searchTerm);
});

// Function to update autocomplete suggestions
function updateSuggestions(searchTerm) {
    const suggestionsList = document.getElementById('suggestionsList');
    
    if (!searchTerm.trim()) {
        suggestionsList.style.display = 'none';
        suggestionsList.innerHTML = '';
        return;
    }
    
    // Get unique symbols from allData
    const symbols = [...new Set(allData.map(row => row['Symbol']))];
    
    // Filter symbols that match the search term (case-insensitive)
    const matches = symbols.filter(symbol => 
        symbol.toUpperCase().includes(searchTerm.toUpperCase())
    ).sort();
    
    // Show suggestions if there are matches
    if (matches.length > 0) {
        suggestionsList.innerHTML = matches.map(match => 
            `<li style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0; transition: background 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='white'" onclick="selectSuggestion('${match}')">${match}</li>`
        ).join('');
        suggestionsList.style.display = 'block';
    } else {
        suggestionsList.style.display = 'none';
        suggestionsList.innerHTML = '';
    }
}

// Function to select a suggestion
function selectSuggestion(symbol) {
    document.getElementById('searchInput').value = symbol;
    document.getElementById('suggestionsList').style.display = 'none';
    filterTable(symbol);
}

// Close suggestions when clicking outside
document.addEventListener('click', (e) => {
    const searchInput = document.getElementById('searchInput');
    const suggestionsList = document.getElementById('suggestionsList');
    
    if (e.target !== searchInput && !suggestionsList.contains(e.target)) {
        suggestionsList.style.display = 'none';
    }
});

// Event listeners for dropdown filters
document.getElementById('dailyFilter').addEventListener('change', () => {
    const searchTerm = document.getElementById('searchInput').value;
    filterTable(searchTerm);
});

document.getElementById('weeklyFilter').addEventListener('change', () => {
    const searchTerm = document.getElementById('searchInput').value;
    filterTable(searchTerm);
});

document.getElementById('monthlyFilter').addEventListener('change', () => {
    const searchTerm = document.getElementById('searchInput').value;
    filterTable(searchTerm);
});

// Helper function to clean and format notes with sized images
function cleanNotesText(htmlText) {
    if (!htmlText) return { text: '', html: '' };
    
    // Replace <br> tags and block element closing tags with a unique placeholder
    const placeholder = '|||LINEBREAK|||';
    let processedHtml = htmlText
        .replace(/<br\s*\/?>/gi, placeholder)
        .replace(/<\/p>/gi, placeholder)
        .replace(/<\/div>/gi, placeholder)
        .replace(/<\/li>/gi, placeholder)
        .replace(/<\/blockquote>/gi, placeholder);
    
    // Create a temporary container to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = processedHtml;
    
    // Style all images to be smaller
    const imgElements = temp.querySelectorAll('img');
    imgElements.forEach(img => {
        img.style.maxWidth = '200px';
        img.style.maxHeight = '200px';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.margin = '8px 0';
    });
    
    // Get text content (placeholder will be preserved)
    const textContent = temp.textContent || temp.innerText || '';
    
    // Split by placeholder to get individual lines
    const lines = textContent.split(placeholder)
        .map(line => line.trim())
        .filter(line => line.length > 0);
    
    // Process each line: if it doesn't end with punctuation, add a period
    const processedLines = lines.map(line => {
        line = line.trim();
        // If line doesn't end with punctuation, add a period
        if (line && !line.match(/[.!?]$/)) {
            line = line + '.';
        }
        return line;
    });
    
    // Join with space (periods already in place)
    let formattedText = processedLines.join(' ');
    
    // Ensure periods are followed by a space
    formattedText = formattedText.replace(/\.([^ ])/g, '. $1');
    
    // Return formatted text with the images
    return { text: formattedText, html: temp.innerHTML };
}

// Helper to extract just the text from notes
function getCleanNotesText(htmlText) {
    const result = cleanNotesText(htmlText);
    return typeof result === 'object' ? result.text : result;
}

// Print to PDF function - Summary format with only selected values
function printToPDF() {
    const incomplete = validateData();
    
    if (incomplete.length > 0) {
        const incompleteSymbols = [...new Set(incomplete.map(item => item.symbol))].join(', ');
        const confirmPrint = confirm(
            `WARNING: The following symbols have missing selections:\n\n${incompleteSymbols}\n\nDo you want to continue printing anyway?`
        );
        
        if (!confirmPrint) {
            return;
        }
    }
    
    // Create summary document with only selected values
    const summaryContainer = document.createElement('div');
    summaryContainer.id = 'pdf-summary-container';
    summaryContainer.style.display = 'none';
    summaryContainer.style.padding = '20px';
    summaryContainer.style.fontFamily = 'Arial, sans-serif';
    summaryContainer.style.lineHeight = '1.6';
    
    // Add title
    const title = document.createElement('h1');
    title.textContent = 'Trade Analysis Summary';
    title.style.textAlign = 'center';
    title.style.marginBottom = '10px';
    summaryContainer.appendChild(title);
    
    // Add date
    const dateEl = document.createElement('p');
    const today = new Date();
    dateEl.textContent = `Generated: ${today.toLocaleDateString()} ${today.toLocaleTimeString()}`;
    dateEl.style.textAlign = 'center';
    dateEl.style.color = '#666';
    dateEl.style.marginBottom = '30px';
    summaryContainer.appendChild(dateEl);
    
    // Filter and display only non-skipped symbols
    const nonSkippedData = allData.filter(row => row['Skip'] !== 'true' && row['Skip'] !== true);
    
    if (nonSkippedData.length === 0) {
        const noData = document.createElement('p');
        noData.textContent = 'No symbols selected for export.';
        noData.style.textAlign = 'center';
        noData.style.color = '#999';
        summaryContainer.appendChild(noData);
    } else {
        // Create summary for each symbol
        nonSkippedData.forEach((row, index) => {
            const symbolSection = document.createElement('div');
            symbolSection.style.marginBottom = '30px';
            symbolSection.style.borderBottom = '1px solid #ddd';
            symbolSection.style.paddingBottom = '20px';
            symbolSection.style.pageBreakInside = 'avoid';  // Keep symbol and its data together
            
            // Symbol name as heading
            const symbolHeading = document.createElement('h2');
            symbolHeading.textContent = row['Symbol'] || 'Unknown';
            symbolHeading.style.fontSize = '18px';
            symbolHeading.style.color = '#333';
            symbolHeading.style.marginBottom = '12px';
            symbolHeading.style.pageBreakAfter = 'avoid';  // Keep heading with data
            symbolSection.appendChild(symbolHeading);
            
            // Create a table for daily, weekly, monthly columns
            const tableContainer = document.createElement('div');
            tableContainer.style.display = 'flex';
            tableContainer.style.gap = '15px';
            tableContainer.style.marginBottom = '16px';
            tableContainer.style.pageBreakInside = 'avoid';  // Keep columns together
            
            // Collect EMA (Macro Trend) selections - shared across all timeframes
            const emaTrends = [];
            ['Bull', 'Bear', 'Tumbling'].forEach(trend => {
                if (row[`MacroTrend${trend}`] === 'true' || row[`MacroTrend${trend}`] === true) {
                    emaTrends.push(trend);
                }
            });
            
            // Collect SMA(200) selections - shared across all timeframes
            const smaTrends = [];
            ['Bull', 'Bear', 'Tumbling'].forEach(trend => {
                if (row[`SMA200${trend}`] === 'true' || row[`SMA200${trend}`] === true) {
                    smaTrends.push(trend);
                }
            });
            
            // Build macro trend text once
            let macroTrendText = [];
            if (emaTrends.length > 0) {
                macroTrendText.push(`EMA: ${emaTrends.join(', ')}`);
            }
            if (smaTrends.length > 0) {
                macroTrendText.push(`SMA: ${smaTrends.join(', ')}`);
            }
            const macroTrendDisplay = macroTrendText.length > 0 ? `Macro Trend: ${macroTrendText.join('; ')}` : '';
            
            // Function to create column
            const createColumn = (title, value, macroTrend, borderColor) => {
                const column = document.createElement('div');
                column.style.flex = '1';
                column.style.minWidth = '120px';
                column.style.padding = '12px';
                column.style.backgroundColor = '#f8f9fb';
                column.style.borderRadius = '4px';
                column.style.borderLeft = `3px solid ${borderColor}`;
                
                const label = document.createElement('div');
                label.style.fontWeight = '700';
                label.style.fontSize = '13px';
                label.style.color = borderColor;
                label.style.marginBottom = '8px';
                label.textContent = title;
                column.appendChild(label);
                
                const content = document.createElement('div');
                content.style.fontSize = '13px';
                content.style.color = '#333';
                content.style.lineHeight = '1.5';
                content.textContent = value || '—';
                column.appendChild(content);
                
                if (macroTrend) {
                    const macro = document.createElement('div');
                    macro.style.fontSize = '12px';
                    macro.style.color = '#666';
                    macro.style.marginTop = '8px';
                    macro.style.paddingTop = '8px';
                    macro.style.borderTop = '1px solid #ddd';
                    macro.textContent = macroTrend;
                    column.appendChild(macro);
                }
                
                return column;
            };
            
            // Daily column
            if (row['Daily'] && row['Daily'] !== '') {
                const dailyValue = row['Daily'].charAt(0).toUpperCase() + row['Daily'].slice(1);
                tableContainer.appendChild(createColumn('Daily', dailyValue, macroTrendDisplay, '#0066cc'));
            }
            
            // Weekly column
            if (row['Weekly'] && row['Weekly'] !== '') {
                const weeklyValue = row['Weekly'].charAt(0).toUpperCase() + row['Weekly'].slice(1);
                tableContainer.appendChild(createColumn('Weekly', weeklyValue, macroTrendDisplay, '#00aa00'));
            }
            
            // Monthly column
            if (row['Monthly'] && row['Monthly'] !== '') {
                const monthlyValue = row['Monthly'].charAt(0).toUpperCase() + row['Monthly'].slice(1);
                tableContainer.appendChild(createColumn('Monthly', monthlyValue, macroTrendDisplay, '#cc6600'));
            }
            
            symbolSection.appendChild(tableContainer);
            
            // Add notes if available
            if (row['DailyNotes'] && row['DailyNotes'].trim() !== '') {
                const notesDiv = document.createElement('div');
                notesDiv.style.marginTop = '12px';
                notesDiv.style.backgroundColor = '#f9f9f9';
                notesDiv.style.padding = '10px';
                notesDiv.style.borderRadius = '4px';
                notesDiv.style.borderLeft = '4px solid #0066cc';
                notesDiv.style.pageBreakInside = 'avoid';
                
                const notesLabel = document.createElement('strong');
                notesLabel.textContent = 'Daily Notes: ';
                notesDiv.appendChild(notesLabel);
                
                const notesText = document.createElement('div');
                const cleanedResult = cleanNotesText(row['DailyNotes']);
                // Display formatted text with images
                notesText.innerHTML = cleanedResult.text;
                // Add images after text if they exist
                const tempImg = document.createElement('div');
                tempImg.innerHTML = cleanedResult.html;
                const imgs = tempImg.querySelectorAll('img');
                if (imgs.length > 0) {
                    const imgDiv = document.createElement('div');
                    imgDiv.style.marginTop = '8px';
                    imgs.forEach(img => {
                        imgDiv.appendChild(img.cloneNode(true));
                    });
                    notesDiv.appendChild(notesText);
                    notesDiv.appendChild(imgDiv);
                } else {
                    notesDiv.appendChild(notesText);
                }
                notesText.style.marginTop = '8px';
                notesText.style.fontSize = '13px';
                
                symbolSection.appendChild(notesDiv);
            }
            
            if (row['WeeklyNotes'] && row['WeeklyNotes'].trim() !== '') {
                const notesDiv = document.createElement('div');
                notesDiv.style.marginTop = '12px';
                notesDiv.style.backgroundColor = '#f9f9f9';
                notesDiv.style.padding = '10px';
                notesDiv.style.borderRadius = '4px';
                notesDiv.style.borderLeft = '4px solid #00aa00';
                notesDiv.style.pageBreakInside = 'avoid';
                
                const notesLabel = document.createElement('strong');
                notesLabel.textContent = 'Weekly Notes: ';
                notesDiv.appendChild(notesLabel);
                
                const notesText = document.createElement('div');
                const cleanedResult = cleanNotesText(row['WeeklyNotes']);
                // Display formatted text with images
                notesText.innerHTML = cleanedResult.text;
                // Add images after text if they exist
                const tempImg = document.createElement('div');
                tempImg.innerHTML = cleanedResult.html;
                const imgs = tempImg.querySelectorAll('img');
                if (imgs.length > 0) {
                    const imgDiv = document.createElement('div');
                    imgDiv.style.marginTop = '8px';
                    imgs.forEach(img => {
                        imgDiv.appendChild(img.cloneNode(true));
                    });
                    notesDiv.appendChild(notesText);
                    notesDiv.appendChild(imgDiv);
                } else {
                    notesDiv.appendChild(notesText);
                }
                notesText.style.marginTop = '8px';
                notesText.style.fontSize = '13px';
                
                symbolSection.appendChild(notesDiv);
            }
            
            if (row['MonthlyNotes'] && row['MonthlyNotes'].trim() !== '') {
                const notesDiv = document.createElement('div');
                notesDiv.style.marginTop = '12px';
                notesDiv.style.backgroundColor = '#f9f9f9';
                notesDiv.style.padding = '10px';
                notesDiv.style.borderRadius = '4px';
                notesDiv.style.borderLeft = '4px solid #cc6600';
                notesDiv.style.pageBreakInside = 'avoid';
                
                const notesLabel = document.createElement('strong');
                notesLabel.textContent = 'Monthly Notes: ';
                notesDiv.appendChild(notesLabel);
                
                const notesText = document.createElement('div');
                const cleanedResult = cleanNotesText(row['MonthlyNotes']);
                // Display formatted text with images
                notesText.innerHTML = cleanedResult.text;
                // Add images after text if they exist
                const tempImg = document.createElement('div');
                tempImg.innerHTML = cleanedResult.html;
                const imgs = tempImg.querySelectorAll('img');
                if (imgs.length > 0) {
                    const imgDiv = document.createElement('div');
                    imgDiv.style.marginTop = '8px';
                    imgs.forEach(img => {
                        imgDiv.appendChild(img.cloneNode(true));
                    });
                    notesDiv.appendChild(notesText);
                    notesDiv.appendChild(imgDiv);
                } else {
                    notesDiv.appendChild(notesText);
                }
                notesText.style.marginTop = '8px';
                notesText.style.fontSize = '13px';
                
                symbolSection.appendChild(notesDiv);
            }
            
            summaryContainer.appendChild(symbolSection);
        });
    }
    
    // Hide the original table and controls
    const tableSection = document.getElementById('tableSection');
    const controlsSection = document.getElementById('controlsSection');
    const headerRow = document.getElementById('headerRow');
    const tableBody = document.getElementById('tableBody');
    const headerContainer = document.querySelector('.header-container');
    const searchBox = document.querySelector('.search-box');
    const watchlistTable = document.getElementById('watchlistTable');
    const noResults = document.getElementById('noResults');
    const dbStatusMessage = document.getElementById('dbStatusMessage');
    const validationErrors = document.getElementById('validationErrors');
    const versionDiv = document.querySelector('div[style*="text-align: center"][style*="Version"]') || 
                       Array.from(document.querySelectorAll('div')).find(div => div.textContent.includes('Version 1.0'));
    
    const originalDisplay = tableSection ? tableSection.style.display : '';
    const originalControlsDisplay = controlsSection ? controlsSection.style.display : '';
    const originalHeaderDisplay = headerRow ? headerRow.style.display : '';
    const originalBodyDisplay = tableBody ? tableBody.style.display : '';
    const originalHeaderContainerDisplay = headerContainer ? headerContainer.style.display : '';
    const originalSearchBoxDisplay = searchBox ? searchBox.style.display : '';
    const originalTableDisplay = watchlistTable ? watchlistTable.style.display : '';
    const originalNoResultsDisplay = noResults ? noResults.style.display : '';
    const originalDbStatusDisplay = dbStatusMessage ? dbStatusMessage.style.display : '';
    const originalValidationDisplay = validationErrors ? validationErrors.style.display : '';
    const originalVersionDisplay = versionDiv ? versionDiv.style.display : '';
    
    if (tableSection) tableSection.style.display = 'none';
    if (controlsSection) controlsSection.style.display = 'none';
    if (headerRow) headerRow.style.display = 'none';
    if (tableBody) tableBody.style.display = 'none';
    if (headerContainer) headerContainer.style.display = 'none';
    if (searchBox) searchBox.style.display = 'none';
    if (watchlistTable) watchlistTable.style.display = 'none';
    if (noResults) noResults.style.display = 'none';
    if (dbStatusMessage) dbStatusMessage.style.display = 'none';
    if (validationErrors) validationErrors.style.display = 'none';
    if (versionDiv) versionDiv.style.display = 'none';
    
    // Append to DOM and print
    document.body.appendChild(summaryContainer);
    summaryContainer.style.display = 'block';
    
    // Wait for DOM to render before printing
    setTimeout(() => {
        window.print();
        
        // Restore visibility and remove summary container after printing
        setTimeout(() => {
            if (tableSection) tableSection.style.display = originalDisplay;
            if (controlsSection) controlsSection.style.display = originalControlsDisplay;
            if (headerRow) headerRow.style.display = originalHeaderDisplay;
            if (tableBody) tableBody.style.display = originalBodyDisplay;
            if (headerContainer) headerContainer.style.display = originalHeaderContainerDisplay;
            if (searchBox) searchBox.style.display = originalSearchBoxDisplay;
            if (watchlistTable) watchlistTable.style.display = originalTableDisplay;
            if (noResults) noResults.style.display = originalNoResultsDisplay;
            if (dbStatusMessage) dbStatusMessage.style.display = originalDbStatusDisplay;
            if (validationErrors) validationErrors.style.display = originalValidationDisplay;
            if (versionDiv) versionDiv.style.display = originalVersionDisplay;
            document.body.removeChild(summaryContainer);
        }, 500);
    }, 250);
}

// Show validation errors
function showValidationErrors(errors) {
    const errorContainer = document.getElementById('validationErrors');
    
    if (!errorContainer) {
        console.error('Validation error container not found');
        return;
    }
    
    if (errors.length === 0) {
        errorContainer.style.display = 'none';
        errorContainer.innerHTML = '';
        return;
    }
    
    // Separate errors by type
    const missingSelectionErrors = errors.filter(e => e.type === 'missing-selection');
    const macroTrendErrors = errors.filter(e => e.type === 'macro-trend');
    
    // Group errors by symbol
    const missingSelectionBySymbol = {};
    const macroTrendBySymbol = {};
    
    missingSelectionErrors.forEach(error => {
        if (!missingSelectionBySymbol[error.symbol]) {
            missingSelectionBySymbol[error.symbol] = [];
        }
        missingSelectionBySymbol[error.symbol].push(error.column);
    });
    
    macroTrendErrors.forEach(error => {
        if (!macroTrendBySymbol[error.symbol]) {
            macroTrendBySymbol[error.symbol] = [];
        }
        macroTrendBySymbol[error.symbol].push(error.column);
    });
    
    // Build error HTML with close button
    let errorHTML = '<div style="padding: 12px; position: relative;"><div style="padding-right: 50px;"><strong>⚠️ Validation Errors - Cannot Save:</strong><ul style="margin: 10px 0; padding-left: 20px;">';
    
    // Show missing selection errors
    if (Object.keys(missingSelectionBySymbol).length > 0) {
        errorHTML += '<li style="margin-bottom: 8px;"><strong>Missing Selections:</strong><ul style="margin: 4px 0; padding-left: 20px;">';
        Object.keys(missingSelectionBySymbol).forEach(symbol => {
            const columns = missingSelectionBySymbol[symbol].join(', ');
            errorHTML += `<li>${symbol}: ${columns}</li>`;
        });
        errorHTML += '</ul></li>';
    }
    
    // Show macro trend errors
    if (Object.keys(macroTrendBySymbol).length > 0) {
        errorHTML += '<li style="margin-bottom: 8px;"><strong>Missing Macro Trend Selection:</strong><ul style="margin: 4px 0; padding-left: 20px;">';
        Object.keys(macroTrendBySymbol).forEach(symbol => {
            const columns = macroTrendBySymbol[symbol].join(', ');
            errorHTML += `<li>${symbol}: ${columns} (Bull, Bear, or Tumbling must be selected)</li>`;
        });
        errorHTML += '</ul></li>';
    }
    
    errorHTML += '</ul></div><button id="closeErrorBtn" style="position: absolute; top: 12px; right: 12px; background-color: #f44336; color: white; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-weight: bold; min-width: 60px;">Close</button></div>';
    
    errorContainer.innerHTML = errorHTML;
    errorContainer.style.display = 'block';
    
    // Add close button event listener
    const closeBtn = document.getElementById('closeErrorBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', clearValidationErrors);
    }
    
    // Scroll to errors
    errorContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Clear validation errors
function clearValidationErrors() {
    const errorContainer = document.getElementById('validationErrors');
    if (errorContainer) {
        errorContainer.style.display = 'none';
        errorContainer.innerHTML = '';
    }
}

// Save current data to database
async function handleSaveToDatabase() {
    if (allData.length === 0) {
        showDBMessage('No data to save', false);
        clearValidationErrors();
        return;
    }
    
    // Validate data before saving
    const incomplete = validateData();
    
    if (incomplete.length > 0) {
        const missingSelectionCount = incomplete.filter(e => e.type === 'missing-selection').length;
        const macroTrendCount = incomplete.filter(e => e.type === 'macro-trend').length;
        
        let errorDetails = [];
        if (missingSelectionCount > 0) errorDetails.push(`${missingSelectionCount} missing selection(s)`);
        if (macroTrendCount > 0) errorDetails.push(`${macroTrendCount} missing Macro Trend(s)`);
        
        showValidationErrors(incomplete);
        
        const continueSave = confirm(
            `⚠️ Validation Errors Found:\n\n${errorDetails.join(', ')}\n\nThese errors should be fixed before saving. Do you want to:\n\n[OK] Continue saving (errors will be saved as-is)\n[Cancel] Go back and fix errors`
        );
        
        if (!continueSave) {
            showDBMessage(`Cannot save: ${errorDetails.join(', ')}. Please review the errors above.`, false);
            return;
        }
    } else {
        clearValidationErrors();
    }
    
    const saveButton = document.getElementById('saveToDBButton');
    const originalText = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    
    try {
        const result = await saveToDatabase(allData);
        showDBMessage(`✓ ${result.message}`, true);
        clearValidationErrors();
    } catch (error) {
        showDBMessage(`✗ Error: ${error.message}`, false);
        console.error('Save error:', error);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = originalText;
    }
}

// Load data from database
async function handleLoadFromDatabase() {
    const loadButton = document.getElementById('loadFromDBButton');
    const originalText = loadButton.textContent;
    loadButton.disabled = true;
    loadButton.textContent = 'Loading...';
    
    try {
        const data = await loadFromDatabase();
        
        if (data.length === 0) {
            showDBMessage('No data found in database', false);
            loadButton.disabled = false;
            loadButton.textContent = originalText;
            return;
        }
        
        allData = data;
        const headers = Object.keys(data[0]);
        saveToCache(headers, data);
        populateTable(headers, data);
        highlightIncompleteRows();
        
        showDBMessage(`✓ Loaded ${data.length} records from database`, true);
    } catch (error) {
        showDBMessage(`✗ Error: ${error.message}`, false);
        console.error('Load error:', error);
    } finally {
        loadButton.disabled = false;
        loadButton.textContent = originalText;
    }
}

// Load CSV on page load
window.addEventListener('DOMContentLoaded', () => {
    displayCurrentDate();
    
    // Try to load from cache first
    const cachedData = getCachedData();
    if (cachedData) {
        allData = cachedData.data;
        populateTable(cachedData.headers, cachedData.data);
        highlightIncompleteRows();
    } else {
        loadCSV();
    }
    
    document.getElementById('csvFile').addEventListener('change', handleFileUpload);
    document.getElementById('printButton').addEventListener('click', printToPDF);
    document.getElementById('clearCacheButton').addEventListener('click', clearCache);
    document.getElementById('saveToDBButton').addEventListener('click', handleSaveToDatabase);
    document.getElementById('loadFromDBButton').addEventListener('click', handleLoadFromDatabase);
});
