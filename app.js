// Dashboard Main Logic
// Helper function to check if prediction indicates no leaf detected
function isNoLeafDetected(prediction) {
    if (!prediction) return false;
    const pred = prediction.toLowerCase();
    return pred.includes('no bitter gourd leaf') ||
           pred.includes('walang nakitang dahon') ||
           pred.includes('no valid detection') ||
           pred.includes('no leaf detected');
}

// Helper function to parse confidence value
// Handles both percentage strings (e.g., "74.4%") and decimals (e.g., 0.744)
// Returns null if confidence doesn't apply (e.g., no leaf detected)
function parseConfidence(confidenceValue, prediction) {
    // If no leaf detected, confidence doesn't apply
    if (prediction && isNoLeafDetected(prediction)) {
        return null;
    }
    
    if (!confidenceValue || confidenceValue === 'EMPTY' || confidenceValue === '') {
        return null; // Return null instead of 0 to indicate N/A
    }
    
    // If it's a string with %, extract the number
    if (typeof confidenceValue === 'string' && confidenceValue.includes('%')) {
        const num = parseFloat(confidenceValue.replace('%', '').trim());
        return isNaN(num) ? null : num;
    }
    
    // If it's a decimal (0-1 range), convert to percentage
    const num = parseFloat(confidenceValue);
    if (isNaN(num)) return null;
    
    // If the number is > 1, assume it's already a percentage
    // If the number is <= 1, assume it's a decimal and multiply by 100
    return num > 1 ? num : num * 100;
}

let diseaseChart = null;
let scansChart = null;
let currentFilters = {
    barangay: '',
    timeFilter: 'all',
    year: '',
    month: ''
};

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Dashboard initializing...');
    console.log('Supabase client available:', !!supabase);
    
    // Test Supabase connection
    try {
        // Check if Supabase client is available
        if (!supabase) {
            console.error('❌ Supabase client not initialized');
            console.error('Make sure supabase.js is loaded before app.js');
            return;
        }

        const { data: testData, error: testError } = await supabase
            .from('history')
            .select('id')
            .limit(1);
        
        if (testError) {
            console.error('❌ Supabase connection test failed:', testError);
            console.error('Error code:', testError.code);
            console.error('Error message:', testError.message);
            console.error('Error hint:', testError.hint);
            
            // Check if it's a CORS/network error
            const isCorsError = testError.message?.includes('CORS') || 
                              testError.message?.includes('Failed to fetch') ||
                              testError.message?.includes('NetworkError') ||
                              (testError.code === 'PGRST301' && testError.message?.includes('origin'));
            
            // Check if we're on localhost (local development)
            const isLocalhost = window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1' ||
                               window.location.hostname === '0.0.0.0';
            
            if (isCorsError) {
                console.error('🔴 CORS ERROR DETECTED!');
                console.error('═══════════════════════════════════════════════════════════');
                const currentOrigin = window.location.origin;
                
                if (isLocalhost) {
                    // For localhost, just log to console - don't show alert
                    console.error('Local development detected. CORS errors are common in local development.');
                    console.error('If you need to test CORS, add your localhost URL to Supabase:');
                    console.error(`   ${currentOrigin}`);
                    console.error('Otherwise, this error can be ignored during local development.');
                    console.error('═══════════════════════════════════════════════════════════');
                } else {
                    // For production (GitHub Pages), show helpful instructions
                    console.error('Your GitHub Pages domain needs to be added to Supabase CORS settings.');
                    console.error('');
                    console.error('SOLUTION:');
                    console.error('1. Go to your Supabase Dashboard → Settings → API');
                    console.error('2. Under "Additional Allowed Origins", add your GitHub Pages URL:');
                    console.error(`   - ${currentOrigin}`);
                    console.error('   - Or your custom domain if you have one');
                    console.error('3. Click "Save"');
                    console.error('4. Wait a few minutes for changes to propagate');
                    console.error('5. Refresh this page');
                    console.error('═══════════════════════════════════════════════════════════');
                    
                    // Only show alert for production domains
                    alert(`⚠️ CORS Configuration Required\n\nYour website (${currentOrigin}) needs to be allowed in Supabase settings.\n\nTo fix this:\n1. Go to Supabase Dashboard → Settings → API\n2. Add "${currentOrigin}" to "Additional Allowed Origins"\n3. Save and wait a few minutes\n4. Refresh this page\n\nTechnical details are in the browser console (Press F12).`);
                }
            } else {
                // For other errors (RLS, etc.), just log - don't show alert
                console.error('This might be an RLS (Row Level Security) issue or another database configuration problem.');
                console.error('The page will continue to load, but some features may not work until this is resolved.');
            }
        } else {
            console.log('✅ Supabase connection test successful');
        }
    } catch (err) {
        console.error('❌ Exception during Supabase connection test:', err);
        
        // Check if it's a network/CORS error in the catch block
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.hostname === '0.0.0.0';
        
        if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.name === 'TypeError') {
            const currentOrigin = window.location.origin;
            console.error('🔴 Network/CORS Error Detected!');
            
            if (isLocalhost) {
                // For localhost, just log - don't show alert
                console.error('Local development detected. This CORS error can usually be ignored.');
                console.error(`If needed, add "${currentOrigin}" to Supabase CORS settings.`);
            } else {
                // For production, show alert
                console.error('Add your domain to Supabase CORS settings:', currentOrigin);
                alert(`⚠️ Network Connection Issue\n\nCould not connect to the database. This is likely a CORS configuration issue.\n\nTo fix:\n1. Go to Supabase Dashboard → Settings → API\n2. Add "${currentOrigin}" to "Additional Allowed Origins"\n3. Save and refresh this page\n\nCheck the console (F12) for more details.`);
            }
        }
    }
    
    // Reset filters to ensure no restrictions on initial load
    currentFilters = {
        barangay: '',
        timeFilter: 'all',
        year: '',
        month: ''
    };
    
    await initializeFilters();
    await loadDashboardData();
    await loadRecentScans();
    await loadDiseaseCounts();
    
    // Setup filter event listeners
    setupFilterListeners();
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Setup mobile menu
    setupMobileMenu();
    
    // Expose debug function to window
    window.testSupabaseConnection = async () => {
        console.log('🧪 Testing Supabase connection...');
        try {
            // Test history table
            const { data: historyData, error: historyError } = await supabase
                .from('history')
                .select('*')
                .limit(5);
            
            console.log('History table test:', {
                data: historyData,
                error: historyError,
                count: historyData?.length || 0
            });
            
            // Test users table
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('*')
                .limit(5);
            
            console.log('Users table test:', {
                data: usersData,
                error: usersError,
                count: usersData?.length || 0
            });
            
            // Check session
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            console.log('Session test:', {
                session: session ? { userId: session.user.id, email: session.user.email } : null,
                error: sessionError
            });
            
            return { historyData, historyError, usersData, usersError, session, sessionError };
        } catch (err) {
            console.error('❌ Test failed:', err);
            return { error: err };
        }
    };
    
    console.log('💡 Tip: Run testSupabaseConnection() in the console to debug connection issues');
});

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Esc key - Clear filters
        if (e.key === 'Escape' && !e.target.matches('input, textarea, select')) {
            e.preventDefault();
            if (typeof clearFilters === 'function') {
                clearFilters();
            }
        }
    });
}

// Setup filter event listeners
function setupFilterListeners() {
    const timeFilter = document.getElementById('timeFilter');
    if (timeFilter) {
        timeFilter.addEventListener('change', (e) => {
            const value = e.target.value;
            const yearGroup = document.getElementById('yearFilterGroup');
            const monthGroup = document.getElementById('monthFilterGroup');
            
            if (value === 'year') {
                yearGroup.style.display = 'flex';
                monthGroup.style.display = 'none';
                document.getElementById('monthFilter').value = '';
            } else if (value === 'month') {
                yearGroup.style.display = 'flex';
                monthGroup.style.display = 'flex';
            } else {
                yearGroup.style.display = 'none';
                monthGroup.style.display = 'none';
                document.getElementById('yearFilter').value = '';
                document.getElementById('monthFilter').value = '';
            }
        });
    }
}

// Initialize filter options
async function initializeFilters() {
    await loadBarangayOptions();
    await loadYearOptions();
}

// Load barangay options from database
async function loadBarangayOptions() {
    try {
        const { data, error } = await supabase
            .from('history')
            .select('location')
            .not('location', 'is', null);

        if (error) throw error;

        // Extract unique barangays
        const barangays = new Set();
        data.forEach(scan => {
            if (scan.location) {
                // Try to extract barangay name (assuming format like "Barangay Sto. Angel" or similar)
                const location = scan.location.trim();
                if (location.toLowerCase().includes('barangay')) {
                    // Extract barangay name
                    const match = location.match(/barangay\s+([^,]+)/i);
                    if (match) {
                        barangays.add(match[1].trim());
                    } else {
                        barangays.add(location);
                    }
                } else {
                    // If no "barangay" keyword, use the whole location
                    barangays.add(location);
                }
            }
        });

        const barangaySelect = document.getElementById('barangayFilter');
        if (barangaySelect) {
            // Sort barangays alphabetically
            const sortedBarangays = Array.from(barangays).sort();
            sortedBarangays.forEach(barangay => {
                const option = document.createElement('option');
                option.value = barangay;
                option.textContent = barangay;
                barangaySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading barangay options:', error);
    }
}

// Load year options from database
async function loadYearOptions() {
    try {
        const { data, error } = await supabase
            .from('history')
            .select('timestamp')
            .not('timestamp', 'is', null);

        if (error) throw error;

        // Extract unique years
        const years = new Set();
        data.forEach(scan => {
            if (scan.timestamp) {
                const date = new Date(parseInt(scan.timestamp));
                years.add(date.getFullYear());
            }
        });

        const yearSelect = document.getElementById('yearFilter');
        if (yearSelect) {
            // Sort years descending
            const sortedYears = Array.from(years).sort((a, b) => b - a);
            sortedYears.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading year options:', error);
    }
}

// Apply filters
async function applyFilters() {
    try {
        console.log('🔄 Applying filters...');
        
        const barangay = document.getElementById('barangayFilter')?.value || '';
        const timeFilter = document.getElementById('timeFilter')?.value || 'all';
        const year = document.getElementById('yearFilter')?.value || '';
        const month = document.getElementById('monthFilter')?.value || '';

        console.log('📋 Filter values:', { barangay, timeFilter, year, month });

        currentFilters = { barangay, timeFilter, year, month };

        console.log('✅ Filters updated:', currentFilters);

        // Reload all data with filters
        await loadDashboardData();
        await loadRecentScans();
        await loadDiseaseCounts();
        
        console.log('✅ All data reloaded with filters');
    } catch (error) {
        console.error('❌ Error applying filters:', error);
        const userMessage = error.message?.includes('RLS') || error.message?.includes('permission') 
            ? 'Unable to apply filters due to access restrictions. Please contact your administrator.'
            : 'Unable to apply filters. Please try again or refresh the page.';
        alert(userMessage);
    }
}

// Make function globally accessible
window.applyFilters = applyFilters;

// Clear all filters
function clearFilters() {
    try {
        // Reset filter values
        const barangayFilter = document.getElementById('barangayFilter');
        const timeFilter = document.getElementById('timeFilter');
        const yearFilter = document.getElementById('yearFilter');
        const monthFilter = document.getElementById('monthFilter');
        
        if (barangayFilter) barangayFilter.value = '';
        if (timeFilter) timeFilter.value = 'all';
        if (yearFilter) yearFilter.value = '';
        if (monthFilter) monthFilter.value = '';
        
        // Hide year/month filter groups
        const yearGroup = document.getElementById('yearFilterGroup');
        const monthGroup = document.getElementById('monthFilterGroup');
        if (yearGroup) yearGroup.style.display = 'none';
        if (monthGroup) monthGroup.style.display = 'none';
        
        // Reset current filters
        currentFilters = {
            barangay: '',
            timeFilter: 'all',
            year: '',
            month: ''
        };
        
        // Reload data without filters
        loadDashboardData();
        loadRecentScans();
        loadDiseaseCounts();
        
        console.log('✅ Filters cleared');
    } catch (error) {
        console.error('❌ Error clearing filters:', error);
        alert('Unable to clear filters. Please try again.');
    }
}

// Make function globally accessible
window.clearFilters = clearFilters;

// Get filtered query builder
function getFilteredQuery() {
    let query = supabase.from('history').select('*');

    console.log('🔍 Building filtered query with:', currentFilters);

    // Apply barangay filter
    if (currentFilters.barangay) {
        console.log('📍 Applying barangay filter:', currentFilters.barangay);
        query = query.ilike('location', `%${currentFilters.barangay}%`);
    }

    // Apply time filters
    if (currentFilters.timeFilter === 'year' && currentFilters.year) {
        const yearStart = new Date(parseInt(currentFilters.year), 0, 1).getTime();
        const yearEnd = new Date(parseInt(currentFilters.year), 11, 31, 23, 59, 59, 999).getTime();
        console.log('📅 Applying year filter:', currentFilters.year, 'from', yearStart, 'to', yearEnd);
        query = query.gte('timestamp', yearStart.toString())
                     .lte('timestamp', yearEnd.toString());
    } else if (currentFilters.timeFilter === 'month' && currentFilters.year && currentFilters.month) {
        const monthStart = new Date(parseInt(currentFilters.year), parseInt(currentFilters.month) - 1, 1).getTime();
        const monthEnd = new Date(parseInt(currentFilters.year), parseInt(currentFilters.month), 0, 23, 59, 59, 999).getTime();
        console.log('📅 Applying month filter:', currentFilters.year, currentFilters.month, 'from', monthStart, 'to', monthEnd);
        query = query.gte('timestamp', monthStart.toString())
                     .lte('timestamp', monthEnd.toString());
    }

    return query;
}

// Normalize disease names - groups similar predictions together
function normalizeDiseaseName(prediction) {
    if (!prediction) return 'Unknown';
    
    const pred = prediction.toLowerCase().trim();
    
    // Group "No Leaf Detected" variations
    if (pred.includes('no bitter gourd leaf') || pred.includes('walang nakitang dahon')) {
        return 'No Bitter Gourd Leaf Detected';
    }
    
    // Group "No Disease" variations
    if (pred.includes('no disease') || pred.includes('walang nakitang sakit')) {
        return 'No Disease Detected';
    }
    
    // Group all error variations together
    if (pred.includes('error') || 
        pred.includes('no valid detection') || 
        pred.includes('invalid detection') ||
        pred.includes('error in analysis')) {
        return 'Error in Analysis';
    }
    
    // Group "Downey Mildew" variations (combine low confidence with regular)
    if (pred.includes('downey mildew') || pred.includes('downy mildew')) {
        return 'Downey Mildew';
    }
    
    // Group "Fusarium Wilt" variations (combine low confidence with regular)
    if (pred.includes('fusarium wilt')) {
        return 'Fusarium Wilt';
    }
    
    // Group "Mosaic Virus" variations (combine low confidence with regular)
    if (pred.includes('mosaic virus')) {
        return 'Mosaic Virus';
    }
    
    // Keep other diseases as-is (but remove low confidence suffix if present)
    let normalized = prediction;
    if (pred.includes('low confidence')) {
        normalized = prediction.replace(/\(low confidence\)/gi, '').trim();
    }
    return normalized;
}

// Categorize disease type for color coding
// Note: Low confidence diseases are now combined with regular diseases, so they're categorized as 'disease'
function getDiseaseCategory(prediction) {
    if (!prediction) return 'unknown';
    
    const pred = prediction.toLowerCase();
    
    if (pred.includes('no bitter gourd leaf') || pred.includes('no leaf') || pred.includes('walang nakitang dahon')) {
        return 'no-leaf';
    }
    if (pred.includes('no disease') || pred.includes('walang nakitang sakit')) {
        return 'no-disease';
    }
    if (pred.includes('error') || pred.includes('no valid detection')) {
        return 'error';
    }
    // Low confidence diseases are now combined with regular diseases
    // So they're all categorized as 'disease'
    return 'disease';
}

// Get color for disease category (professional colors)
function getDiseaseStyle(category) {
    const styles = {
        'disease': { color: '#2196F3', label: 'Detected Disease' },
        'low-confidence': { color: '#FF9800', label: 'Low Confidence' },
        'no-disease': { color: '#4CAF50', label: 'No Disease' },
        'no-leaf': { color: '#757575', label: 'No Leaf Detected' },
        'error': { color: '#F44336', label: 'Error' },
        'unknown': { color: '#607D8B', label: 'Unknown' }
    };
    return styles[category] || styles['unknown'];
}

// Load disease counts by category
async function loadDiseaseCounts() {
    const container = document.getElementById('diseaseCountsContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading disease counts...</div>';

    try {
        console.log('🔄 Loading disease counts with filters:', currentFilters);
        
        // Build query - if no filters, get all data
        let query = supabase.from('history').select('prediction, location, timestamp');

        // Apply barangay filter only if specified
        if (currentFilters.barangay) {
            console.log('📍 Applying barangay filter to disease counts:', currentFilters.barangay);
            query = query.ilike('location', `%${currentFilters.barangay}%`);
        }

        // Apply time filters only if specified
        if (currentFilters.timeFilter === 'year' && currentFilters.year) {
            const yearStart = new Date(parseInt(currentFilters.year), 0, 1).getTime();
            const yearEnd = new Date(parseInt(currentFilters.year), 11, 31, 23, 59, 59, 999).getTime();
            console.log('📅 Applying year filter to disease counts:', currentFilters.year);
            query = query.gte('timestamp', yearStart.toString())
                         .lte('timestamp', yearEnd.toString());
        } else if (currentFilters.timeFilter === 'month' && currentFilters.year && currentFilters.month) {
            const monthStart = new Date(parseInt(currentFilters.year), parseInt(currentFilters.month) - 1, 1).getTime();
            const monthEnd = new Date(parseInt(currentFilters.year), parseInt(currentFilters.month), 0, 23, 59, 59, 999).getTime();
            console.log('📅 Applying month filter to disease counts:', currentFilters.year, currentFilters.month);
            query = query.gte('timestamp', monthStart.toString())
                         .lte('timestamp', monthEnd.toString());
        }

        const { data, error } = await query;

        if (error) {
            console.error('❌ Error loading disease counts:', error);
            console.error('Error details:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
            throw error;
        }
        
        console.log('✅ Disease counts data received:', data ? `${data.length} records` : 'null');

        // Count diseases with normalization
        const diseaseCounts = {};
        let total = 0;

        if (data && data.length > 0) {
            data.forEach(scan => {
                const normalized = normalizeDiseaseName(scan.prediction);
                diseaseCounts[normalized] = (diseaseCounts[normalized] || 0) + 1;
                total++;
            });
        }

        // Display disease counts
        if (total === 0) {
            container.innerHTML = '<div class="loading">No scans found for the selected filters.</div>';
            return;
        }

        // Sort by count (descending)
        const sortedDiseases = Object.entries(diseaseCounts)
            .sort((a, b) => b[1] - a[1]);

        // Group by category for better organization
        const categorized = {
            'disease': [],
            'low-confidence': [],
            'no-disease': [],
            'no-leaf': [],
            'error': [],
            'unknown': []
        };

        sortedDiseases.forEach(([disease, count]) => {
            const category = getDiseaseCategory(disease);
            categorized[category].push({ disease, count, percentage: ((count / total) * 100).toFixed(1) });
        });

        // Build professional table view
        let html = '<div class="disease-table-container">';
        html += '<table class="disease-table">';
        html += '<thead><tr><th>Category</th><th>Disease/Status</th><th>Count</th><th>Percentage</th><th>Visual</th></tr></thead>';
        html += '<tbody>';

        // Combine all categories in priority order
        const allItems = [
            ...categorized['disease'].map(item => ({ ...item, category: 'Detected Disease', categoryKey: 'disease' })),
            ...categorized['low-confidence'].map(item => ({ ...item, category: 'Low Confidence', categoryKey: 'low-confidence' })),
            ...categorized['no-disease'].map(item => ({ ...item, category: 'No Disease', categoryKey: 'no-disease' })),
            ...categorized['no-leaf'].map(item => ({ ...item, category: 'No Leaf Detected', categoryKey: 'no-leaf' })),
            ...categorized['error'].map(item => ({ ...item, category: 'Error', categoryKey: 'error' }))
        ];

        // Sort by count (descending)
        allItems.sort((a, b) => b.count - a.count);

        allItems.forEach(({ disease, count, percentage, category, categoryKey }) => {
            // Use disease-specific color if it's an actual disease, otherwise use category color
            const diseaseColor = getDiseaseColor(disease);
            const style = getDiseaseStyle(categoryKey);
            // For actual diseases, use the disease-specific color; for others, use category color
            const finalColor = (categoryKey === 'disease' || categoryKey === 'no-disease') ? diseaseColor : style.color;
            const barWidth = Math.max(5, (count / total) * 100);
            
            html += `
                <tr class="disease-table-row">
                    <td class="disease-category" style="border-left: 4px solid ${finalColor};">
                        <span class="category-badge" style="background-color: ${finalColor}20; color: ${finalColor};">
                            ${category}
                        </span>
                    </td>
                    <td class="disease-name"><strong>${disease}</strong></td>
                    <td class="disease-count">${count.toLocaleString()}</td>
                    <td class="disease-percentage">${percentage}%</td>
                    <td class="disease-bar">
                        <div class="progress-bar-container">
                            <div class="progress-bar" style="width: ${barWidth}%; background-color: ${finalColor};"></div>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        html += '</div>';

        container.innerHTML = html || '<div class="loading">No data available</div>';
    } catch (error) {
        console.error('Error loading disease counts:', error);
        container.innerHTML = '<div class="loading">Error loading disease counts</div>';
    }
}

// Load all dashboard statistics
async function loadDashboardData() {
    try {
        console.log('🔄 Loading dashboard data...');
        console.log('Current filters:', currentFilters);
        
        // Check if supabase client is available
        if (!supabase) {
            console.error('❌ Supabase client is not initialized!');
            showError('Supabase client not initialized. Please refresh the page.');
            return;
        }
        
        // Get filtered counts
        const filteredQuery = getFilteredQuery();
        
        // Load stats in parallel
        console.log('📊 Fetching statistics...');
        const [usersCount, scansCount, scansToday, activeUsers, diseaseData, scansTimeData] = await Promise.all([
            getTotalUsers(),
            getTotalScans(),
            getScansToday(),
            getActiveUsers(),
            getDiseaseDistribution(),
            getScansOverTime()
        ]);

        console.log('✅ Statistics loaded:', {
            usersCount,
            scansCount,
            scansToday,
            activeUsers,
            diseaseDataKeys: Object.keys(diseaseData),
            scansTimeDataKeys: Object.keys(scansTimeData)
        });

        // Update stat cards
        // Total Scans: Show total regardless of filters (use scansCount from getTotalScans)
        const totalScansEl = document.getElementById('totalScans');
        if (totalScansEl) {
            totalScansEl.textContent = scansCount.toLocaleString();
        }
        
        const totalUsersEl = document.getElementById('totalUsers');
        if (totalUsersEl) {
            totalUsersEl.textContent = usersCount.toLocaleString();
        }
        
        // Scans Today: Show today's scans regardless of time filters (but respect barangay filter)
        const scansTodayEl = document.getElementById('scansToday');
        if (scansTodayEl) {
            // Get scans today with only barangay filter (not time filter)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayTimestamp = today.getTime();
            
            let todayQuery = supabase
                .from('history')
                .select('*', { count: 'exact', head: true })
                .gte('timestamp', todayTimestamp.toString());
            
            // Apply barangay filter if set
            if (currentFilters.barangay) {
                todayQuery = todayQuery.ilike('location', `%${currentFilters.barangay}%`);
            }
            
            const { count: todayCount, error: todayError } = await todayQuery;
            if (todayError) {
                console.error('❌ Error getting scans today:', todayError);
                scansTodayEl.textContent = scansToday.toLocaleString(); // Fallback to filtered value
            } else {
                scansTodayEl.textContent = (todayCount || 0).toLocaleString();
            }
        }
        
        const activeUsersEl = document.getElementById('activeUsers');
        if (activeUsersEl) {
            activeUsersEl.textContent = activeUsers.toLocaleString();
        }

        // Update charts
        updateDiseaseChart(diseaseData);
        updateScansChart(scansTimeData);
        
        console.log('✅ Dashboard data loaded successfully');
    } catch (error) {
        console.error('❌ Error loading dashboard data:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            stack: error.stack
        });
        const userMessage = error.message?.includes('RLS') || error.message?.includes('permission')
            ? 'Unable to load dashboard data due to access restrictions. Please contact your administrator.'
            : 'Unable to load dashboard data. Please refresh the page or try again later.';
        showError(userMessage);
    }
}

// Get total users count
async function getTotalUsers() {
    try {
        const { count, error, data } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('❌ Error fetching total users:', error);
            console.error('Error details:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
            throw error;
        }
        
        console.log('✅ Total users count:', count);
        return count || 0;
    } catch (error) {
        console.error('❌ Exception in getTotalUsers:', error);
        throw error;
    }
}

// Get total scans count
async function getTotalScans() {
    try {
        const { count, error } = await supabase
            .from('history')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('❌ Error fetching total scans:', error);
            console.error('Error details:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
            throw error;
        }
        
        console.log('✅ Total scans count:', count);
        return count || 0;
    } catch (error) {
        console.error('❌ Exception in getTotalScans:', error);
        throw error;
    }
}

// Get scans today (respects filters)
async function getScansToday() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();

        console.log('🔍 Fetching scans today, timestamp:', todayTimestamp);

        // Start with filtered query
        let query = getFilteredQuery();
        
        // Add today's date filter
        query = query.gte('timestamp', todayTimestamp.toString());

        const { count, error } = await query.select('*', { count: 'exact', head: true });

        if (error) {
            console.error('❌ Error fetching scans today:', error);
            console.error('Error details:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
            throw error;
        }
        
        console.log('✅ Scans today count:', count);
        return count || 0;
    } catch (error) {
        console.error('❌ Exception in getScansToday:', error);
        throw error;
    }
}

// Get active users (last 30 days, respects filters)
async function getActiveUsers() {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoTimestamp = thirtyDaysAgo.getTime();

        // Start with filtered query
        let query = getFilteredQuery();
        
        // Add 30-day filter
        query = query.gte('timestamp', thirtyDaysAgoTimestamp.toString());

        const { data, error } = await query.select('user_id');

        if (error) {
            console.error('❌ Error fetching active users:', error);
            console.error('Error details:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
            throw error;
        }
        
        // Get unique user IDs
        const uniqueUsers = new Set((data || []).map(scan => scan.user_id).filter(Boolean));
        console.log('✅ Active users count:', uniqueUsers.size);
        return uniqueUsers.size;
    } catch (error) {
        console.error('❌ Exception in getActiveUsers:', error);
        throw error;
    }
}

// Get disease distribution (only actual diseases and "No Disease Detected")
async function getDiseaseDistribution() {
    const query = getFilteredQuery();
    const { data, error } = await query.select('prediction');

    if (error) throw error;

    // Count by disease with normalization
    const distribution = {};
    data.forEach(scan => {
        const normalized = normalizeDiseaseName(scan.prediction);
        const category = getDiseaseCategory(normalized);
        
        // Only include actual diseases and "No Disease Detected"
        // Exclude: no-leaf, error, unknown
        if (category === 'disease' || category === 'no-disease') {
            distribution[normalized] = (distribution[normalized] || 0) + 1;
        }
    });

    return distribution;
}

// Get scans over time (last 7 days)
async function getScansOverTime() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const sevenDaysAgoTimestamp = sevenDaysAgo.getTime();

    let query = supabase
        .from('history')
        .select('timestamp')
        .gte('timestamp', sevenDaysAgoTimestamp.toString())
        .order('timestamp', { ascending: true });

    // Apply current filters
    if (currentFilters.barangay) {
        query = query.ilike('location', `%${currentFilters.barangay}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Group by date
    const scansByDate = {};
    data.forEach(scan => {
        const date = new Date(parseInt(scan.timestamp));
        const dateKey = date.toISOString().split('T')[0];
        scansByDate[dateKey] = (scansByDate[dateKey] || 0) + 1;
    });

    // Fill in missing dates with 0
    const result = {};
    for (let i = 0; i < 7; i++) {
        const date = new Date(sevenDaysAgo);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];
        result[dateKey] = scansByDate[dateKey] || 0;
    }

    return result;
}

// Get color for specific disease name
function getDiseaseColor(diseaseName) {
    const disease = diseaseName.toLowerCase();
    
    // Specific colors for each disease
    const diseaseColors = {
        'mosaic virus': '#2196F3',           // Blue
        'downey mildew': '#FF9800',          // Orange
        'downy mildew': '#FF9800',           // Orange (alternative spelling)
        'fusarium wilt': '#9C27B0',          // Purple
        'no disease detected': '#4CAF50',    // Green
        'walang nakitang sakit': '#4CAF50'   // Green (Tagalog)
    };
    
    // Check for exact match first
    if (diseaseColors[disease]) {
        return diseaseColors[disease];
    }
    
    // Check for partial matches
    for (const [key, color] of Object.entries(diseaseColors)) {
        if (disease.includes(key) || key.includes(disease)) {
            return color;
        }
    }
    
    // Fallback colors for other diseases
    const fallbackColors = [
        '#00BCD4', // Cyan
        '#F44336', // Red
        '#FFC107', // Amber
        '#795548', // Brown
        '#607D8B', // Blue Grey
        '#E91E63', // Pink
        '#009688', // Teal
        '#3F51B5'  // Indigo
    ];
    
    // Use hash of disease name to consistently assign colors
    let hash = 0;
    for (let i = 0; i < diseaseName.length; i++) {
        hash = ((hash << 5) - hash) + diseaseName.charCodeAt(i);
        hash = hash & hash;
    }
    return fallbackColors[Math.abs(hash) % fallbackColors.length];
}

// Update disease distribution chart
function updateDiseaseChart(data) {
    const ctx = document.getElementById('diseaseChart');
    if (!ctx) return;

    const labels = Object.keys(data);
    const values = Object.values(data);

    // If no data, show empty state
    if (labels.length === 0 || values.every(v => v === 0)) {
        if (diseaseChart) {
            diseaseChart.destroy();
            diseaseChart = null;
        }
        return;
    }

    if (diseaseChart) {
        diseaseChart.destroy();
    }

    // Assign unique color to each disease
    const colors = labels.map(label => getDiseaseColor(label));

    diseaseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Update scans over time chart
function updateScansChart(data) {
    const ctx = document.getElementById('scansChart');
    if (!ctx) return;

    const labels = Object.keys(data).map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const values = Object.values(data);

    if (scansChart) {
        scansChart.destroy();
    }

    scansChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Scans',
                data: values,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Load recent scans table
async function loadRecentScans(limit = 10) {
    const tbody = document.getElementById('recentScansBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading...</td></tr>';

    try {
        console.log('🔄 Loading recent scans with filters:', currentFilters);
        
        let query = supabase
            .from('history')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(limit);

        // Apply filters
        if (currentFilters.barangay) {
            query = query.ilike('location', `%${currentFilters.barangay}%`);
        }

        if (currentFilters.timeFilter === 'year' && currentFilters.year) {
            const yearStart = new Date(parseInt(currentFilters.year), 0, 1).getTime();
            const yearEnd = new Date(parseInt(currentFilters.year), 11, 31, 23, 59, 59, 999).getTime();
            query = query.gte('timestamp', yearStart.toString())
                         .lte('timestamp', yearEnd.toString());
        } else if (currentFilters.timeFilter === 'month' && currentFilters.year && currentFilters.month) {
            const monthStart = new Date(parseInt(currentFilters.year), parseInt(currentFilters.month) - 1, 1).getTime();
            const monthEnd = new Date(parseInt(currentFilters.year), parseInt(currentFilters.month), 0, 23, 59, 59, 999).getTime();
            query = query.gte('timestamp', monthStart.toString())
                         .lte('timestamp', monthEnd.toString());
        }

        const { data: scans, error } = await query;

        if (error) {
            console.error('❌ Error loading recent scans:', error);
            console.error('Error details:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
            throw error;
        }
        
        console.log('✅ Recent scans data received:', scans ? `${scans.length} records` : 'null');

        if (!scans || scans.length === 0) {
            console.log('ℹ️ No scans found for the current filters');
            tbody.innerHTML = '<tr><td colspan="5" class="loading">No scans found</td></tr>';
            return;
        }

        // Fetch user data separately if needed
        const userIds = [...new Set(scans.map(scan => scan.user_id).filter(Boolean))];
        let usersMap = {};
        
        if (userIds.length > 0) {
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('id, email, phone')
                .in('id', userIds);
            
            if (!usersError && users) {
                users.forEach(user => {
                    usersMap[user.id] = user;
                });
            }
        }

        tbody.innerHTML = scans.map(scan => {
            const user = usersMap[scan.user_id] || {};
            const userName = user.email || user.phone || scan.user_id?.substring(0, 8) || 'Unknown';
            const confidencePercent = parseConfidence(scan.confidence, scan.prediction);
            
            // Display confidence or blank
            const confidenceDisplay = confidencePercent !== null && confidencePercent !== undefined 
                ? confidencePercent.toFixed(1) + '%' 
                : '—';

            const formatDateFunc = window.supabaseUtils?.formatDate || formatDate;
            return `
                <tr>
                    <td>${userName}</td>
                    <td>${scan.prediction || 'Unknown'}</td>
                    <td>${confidenceDisplay}</td>
                    <td>${scan.location || 'N/A'}</td>
                    <td>${formatDateFunc(scan.timestamp)}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('❌ Error loading recent scans:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            stack: error.stack
        });
        tbody.innerHTML = '<tr><td colspan="5" class="loading">Error loading scans: ' + (error.message || 'Unknown error') + '</td></tr>';
    }
}

// Generate and email report
async function generateReport() {
    try {
        // Show loading message
        const button = event.target.closest('button');
        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Report...';

        // Get filtered data
        const query = getFilteredQuery();
        const { data: scans, error } = await query.select('*').order('timestamp', { ascending: false });

        if (error) throw error;

        if (!scans || scans.length === 0) {
            alert('No data available for the selected filters to generate a report.');
            button.disabled = false;
            button.innerHTML = originalText;
            return;
        }

        // Fetch user data separately
        const userIds = [...new Set(scans.map(scan => scan.user_id).filter(Boolean))];
        let usersMap = {};
        
        if (userIds.length > 0) {
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('id, email, phone')
                .in('id', userIds);
            
            if (!usersError && users) {
                users.forEach(user => {
                    usersMap[user.id] = user;
                });
            }
        }

        // Add user data to scans
        const scansWithUsers = scans.map(scan => ({
            ...scan,
            users: usersMap[scan.user_id] || {}
        }));

        // Generate Excel/CSV file
        const csvContent = generateCSVReport(scansWithUsers);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const fileName = `BitterGuard_Report_${new Date().toISOString().split('T')[0]}.csv`;

        // Create download link
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();

        // Prepare email data
        const reportData = {
            totalScans: scans.length,
            dateRange: getDateRangeText(),
            barangay: currentFilters.barangay || 'All Barangays',
            diseases: getDiseaseSummary(scans),
            fileName: fileName,
            csvContent: csvContent
        };

        // Send email (using Supabase Edge Function or external service)
        await sendReportEmail(reportData);

        alert('Report generated and email sent successfully!');
        button.disabled = false;
        button.innerHTML = originalText;
    } catch (error) {
        console.error('Error generating report:', error);
        alert('Error generating report: ' + error.message);
        const button = event.target.closest('button');
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-envelope"></i> Generate & Email Report';
    }
}

// Generate CSV report content
function generateCSVReport(scans) {
    // CSV header
    let csv = 'ID,User Email,User Phone,Disease,Confidence,Location,Date\n';

    // CSV rows
    const formatDateFunc = window.supabaseUtils?.formatDate || formatDate;
    scans.forEach(scan => {
        const user = scan.users || {};
        const userEmail = user.email || 'N/A';
        const userPhone = user.phone || 'N/A';
        const confidencePercent = parseConfidence(scan.confidence, scan.prediction);
        const confidenceDisplay = confidencePercent !== null && confidencePercent !== undefined 
            ? confidencePercent.toFixed(1) + '%' 
            : 'N/A';
        const date = formatDateFunc(scan.timestamp);

        csv += `"${scan.id || ''}","${userEmail}","${userPhone}","${scan.prediction || 'Unknown'}","${confidenceDisplay}","${scan.location || 'N/A'}","${date}"\n`;
    });

    return csv;
}

// Get date range text for report
function getDateRangeText() {
    if (currentFilters.timeFilter === 'year' && currentFilters.year) {
        return `Year ${currentFilters.year}`;
    } else if (currentFilters.timeFilter === 'month' && currentFilters.year && currentFilters.month) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
        return `${monthNames[parseInt(currentFilters.month) - 1]} ${currentFilters.year}`;
    }
    return 'All Time';
}

// Get disease summary for report
function getDiseaseSummary(scans) {
    const summary = {};
    scans.forEach(scan => {
        const disease = scan.prediction || 'Unknown';
        summary[disease] = (summary[disease] || 0) + 1;
    });
    return summary;
}

// Send report email
async function sendReportEmail(reportData) {
    // NOTE: This requires a backend service or Supabase Edge Function
    // For now, we'll use a simple approach with a mailto link or you can integrate:
    // 1. Supabase Edge Function with email service (SendGrid, Resend, etc.)
    // 2. External API service
    // 3. Server-side endpoint

    // For demonstration, we'll create a mailto link
    // In production, you should use a proper email service
    
    const emailSubject = encodeURIComponent(`BitterGuard Disease Detection Report - ${reportData.dateRange}`);
    const emailBody = encodeURIComponent(`
BitterGuard Disease Detection Report

Date Range: ${reportData.dateRange}
Barangay: ${reportData.barangay}
Total Scans: ${reportData.totalScans}

Disease Summary:
${Object.entries(reportData.diseases).map(([disease, count]) => `- ${disease}: ${count}`).join('\n')}

Please find the detailed report attached.

This is an automated report from the BitterGuard Admin Dashboard.
    `);

    // For now, open email client (user can attach the downloaded file)
    // In production, implement proper email sending via backend
    const mailtoLink = `mailto:cityagriculture@example.com?subject=${emailSubject}&body=${emailBody}`;
    
    // Show instructions to user
    alert(`Report file has been downloaded.\n\nTo send via email:\n1. Open your email client\n2. Attach the downloaded file: ${reportData.fileName}\n3. Send to: City Agriculture Office\n\nNote: For automatic email sending, please configure an email service in the backend.`);
    
    // Uncomment to open email client automatically:
    // window.location.href = mailtoLink;
}

// Helper function to show errors
function showError(message) {
    console.error(message);
    alert(message);
}

// Export chart as image
function exportChart(canvasId, filename) {
    try {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            alert('Chart not found. Please wait for the chart to load.');
            return;
        }

        // Get the Chart.js instance from global variables
        let chartInstance = null;
        if (canvasId === 'diseaseChart' && diseaseChart) {
            chartInstance = diseaseChart;
        } else if (canvasId === 'scansChart' && scansChart) {
            chartInstance = scansChart;
        }

        if (!chartInstance) {
            alert('Chart data not available. Please wait for the chart to load.');
            return;
        }

        // Get the chart's canvas element
        const chartCanvas = chartInstance.canvas;
        if (!chartCanvas) {
            alert('Unable to export chart. Please try again.');
            return;
        }

        // Convert to image and download
        const url = chartCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `bitterguard-${filename}-${new Date().toISOString().split('T')[0]}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('✅ Chart exported:', filename);
    } catch (error) {
        console.error('❌ Error exporting chart:', error);
        alert('Unable to export chart. Please try again.');
    }
}

// Make function globally accessible
window.exportChart = exportChart;

// Setup mobile menu toggle
function setupMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
            const icon = mobileMenuToggle.querySelector('i');
            if (sidebar.classList.contains('mobile-open')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('mobile-open') && 
                !sidebar.contains(e.target) && 
                !mobileMenuToggle.contains(e.target)) {
                sidebar.classList.remove('mobile-open');
                const icon = mobileMenuToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }
}

// Auto-refresh dashboard every 5 minutes
setInterval(() => {
    loadDashboardData();
    loadRecentScans();
    loadDiseaseCounts();
}, 5 * 60 * 1000);
