// --- CONFIGURATION ---
const CSV_FILE_PATH = 'mit_cgpa.csv';

// --- DOM ELEMENT REFERENCES ---
const courseFilter = document.getElementById('courseFilter');
const sectionFilter = document.getElementById('sectionFilter');
const semesterFilter = document.getElementById('semesterFilter');
const minCgpaInput = document.getElementById('minCgpa');
const maxCgpaInput = document.getElementById('maxCgpa');
const sortBy = document.getElementById('sortBy');
const searchNameInput = document.getElementById('searchName');
const leaderboardBody = document.getElementById('leaderboard-body');
const noResultsDiv = document.getElementById('no-results');
const resetBtn = document.getElementById('resetFilters');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const prevBtnLi = document.getElementById('prev-btn-li');
const nextBtnLi = document.getElementById('next-btn-li');
const pageInfoDiv = document.getElementById('pageInfo');
const paginationControls = document.getElementById('pagination-controls');

// Chart-specific elements
const chartByFilter = document.getElementById('chartBy');
const chartTitle = document.getElementById('chartTitle');
const goToChartBtn = document.getElementById('goToChartBtn');
const goToTopBtn = document.getElementById('goToTopBtn');

let allStudents = [];
let filteredStudents = [];
let currentPage = 1;
const rowsPerPage = 100;

let myChart; // Chart.js instance

// --- DATA UTILITIES ---
function convertSemester(semesterStr) {
    if (!semesterStr) return 0;
    const str = String(semesterStr).toUpperCase().trim();
    if (!isNaN(parseInt(str))) return parseInt(str, 10);
    const romanMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10 };
    return romanMap[str] || 0;
}

function getGpaClass(gpa) {
    if (gpa >= 8.5) return 'gpa-high';
    if (gpa >= 7.5) return 'gpa-good';
    if (gpa >= 6) return 'gpa-mid';
    if (gpa >= 4) return 'gpa-low';
    return 'gpa-fail';
}

// Medal SVG for top ranks
function getMedal(rank) {
    const map = {
        1: { fill: 'gold', num: '1' },
        2: { fill: 'silver', num: '2' },
        3: { fill: '#cd7f32', num: '3' }
    };
    if (!map[rank]) return String(rank);
    const { fill, num } = map[rank];
    return `<svg class="rank-medal" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10" fill="${fill}" stroke="black" stroke-width="1"></circle>
                <text x="12" y="16" text-anchor="middle" font-size="12" fill="black" font-weight="bold">${num}</text>
            </svg>`;
}

// Simple Levenshtein distance
function levenshtein(a, b) {
    const m = [];
    for (let i = 0; i <= b.length; i++) m[i] = [i];
    for (let j = 0; j <= a.length; j++) m[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            m[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
                ? m[i - 1][j - 1]
                : Math.min(
                    m[i - 1][j - 1] + 1,
                    m[i][j - 1] + 1,
                    m[i - 1][j] + 1
                );
        }
    }
    return m[b.length][a.length];
}

// --- CHART INITIALIZATION ---
function initializeChart() {
    const ctx = document.getElementById('cgpaChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Number of Students',
                    data: [],
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    yAxisID: 'y-students'
                },
                {
                    label: 'Average CGPA',
                    data: [],
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    type: 'bar',
                    fill: false,
                    yAxisID: 'y-avg-cgpa'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                'y-students': {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    title: { display: true, text: 'Number of Students' }
                },
                'y-avg-cgpa': {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    max: 10,
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Average CGPA' },
                    ticks: { callback: v => v.toFixed(1) }
                },
                x: { title: { display: true, text: '' }, categoryPercentage: 0.8, barPercentage: 0.7 }
            },
            plugins: { legend: { display: true } }
        }
    });
}

// --- CHART UPDATE ---
function updateChart() {
    if (!myChart) return;

    const chartType = chartByFilter.value;
    let labels = [];
    let data = [];
    let avgCgpaData = [];

    myChart.data.datasets[1].hidden = true;

    if (chartType === 'cgpa') {
        chartTitle.textContent = 'CGPA Distribution';
        const bins = {'0-1':0,'1-2':0,'2-3':0,'3-4':0,'4-5':0,'5-6':0,'6-7':0,'7-8':0,'8-9':0,'9-10':0};
        filteredStudents.forEach(s => {
            const c = s.CGPA;
            const key = `${Math.floor(c)}-${Math.floor(c)+1}`;
            if (c >= 9) bins['9-10']++;
            else if (c >= 8) bins['8-9']++;
            else if (c >= 7) bins['7-8']++;
            else if (c >= 6) bins['6-7']++;
            else if (c >= 5) bins['5-6']++;
            else if (c >= 4) bins['4-5']++;
            else if (c >= 3) bins['3-4']++;
            else if (c >= 2) bins['2-3']++;
            else if (c >= 1) bins['1-2']++;
            else bins['0-1']++;
        });
        labels = Object.keys(bins);
        data = labels.map(l => bins[l]);
    } else {
        let groupingKey = chartType === 'course' ? 'Course Name' : chartType === 'section' ? 'Section' : 'Semester';
        const grouped = {};
        filteredStudents.forEach(s => {
            const key = s[groupingKey];
            if (!grouped[key]) grouped[key] = { count: 0, total: 0 };
            grouped[key].count++;
            grouped[key].total += s.CGPA;
        });
        labels = Object.keys(grouped).sort((a,b) => (groupingKey === 'Semester' ? a-b : a.localeCompare(b)));
        data = labels.map(k => grouped[k].count);
        avgCgpaData = labels.map(k => grouped[k].total / grouped[k].count);
        myChart.data.datasets[1].hidden = false;
    }

    myChart.data.labels = labels;
    myChart.data.datasets[0].data = data;
    myChart.data.datasets[1].data = avgCgpaData;
    myChart.update();
}

// --- DATA FETCH & INIT ---
function loadData() {
    Papa.parse(CSV_FILE_PATH, {
        download: true, header: true, skipEmptyLines: true,
        complete: (results) => {
            allStudents = results.data.map(s => ({
                ...s,
                'Student Name': s['Student Name'] ? s['Student Name'].trim() : 'N/A',
                'Course Name': s['Course Name'] ? s['Course Name'].trim() : 'N/A',
                Section: s.Section ? s.Section.trim() : 'N/A',
                Semester: convertSemester(s.Semester),
                CGPA: parseFloat(s.CGPA) || 0
            }));
            populateFilters();
            initializeChart();
            updateAndFilterDisplay();
        },
        error: (err) => {
            console.error("Error loading CSV:", err);
            leaderboardBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading data</td></tr>`;
        }
    });
}

function populateFilters() {
    const addOptions = (el, opts) => opts.forEach(o => { const opt = document.createElement('option'); opt.value = o; opt.textContent = o; el.appendChild(opt); });
    addOptions(courseFilter, [...new Set(allStudents.map(s => s['Course Name']))].sort());
    addOptions(sectionFilter, [...new Set(allStudents.map(s => s.Section))].sort());
    addOptions(semesterFilter, [...new Set(allStudents.map(s => s.Semester))].filter(s => s>0).sort((a,b)=>a-b));
}

// --- DISPLAY ---
function displayPage() {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginated = filteredStudents.slice(startIndex, startIndex + rowsPerPage);
    leaderboardBody.innerHTML = '';
    paginated.forEach((s, i) => {
        const rank = startIndex + i + 1;
        const row = document.createElement('tr');
        if (rank === 1) row.classList.add('row-gold');
        else if (rank === 2) row.classList.add('row-silver');
        else if (rank === 3) row.classList.add('row-bronze');
        else row.classList.add(getGpaClass(s.CGPA));

        row.innerHTML = `
            <td class="px-4 py-3 fw-medium">${getMedal(rank)}</td>
            <td class="px-4 py-3 fw-semibold">${s['Student Name']}</td>
            <td class="px-4 py-3">${s['Course Name']}</td>
            <td class="px-4 py-3">${s.Section}</td>
            <td class="px-4 py-3">${s.Semester}</td>
            <td class="px-4 py-3 text-end fw-bold text-primary">${s.CGPA.toFixed(2)}</td>
        `;
        leaderboardBody.appendChild(row);
    });
    setupPagination();
}

function setupPagination() {
    const totalPages = Math.ceil(filteredStudents.length / rowsPerPage);
    paginationControls.classList.toggle('d-none', totalPages <= 1);
    pageInfoDiv.textContent = `Page ${currentPage} of ${totalPages}`;
    prevBtnLi.classList.toggle('disabled', currentPage === 1);
    nextBtnLi.classList.toggle('disabled', currentPage === totalPages);
}

function updateAndFilterDisplay() {
    const selCourse = courseFilter.value, selSection = sectionFilter.value, selSemester = semesterFilter.value;
    const min = parseFloat(minCgpaInput.value) || 0, max = parseFloat(maxCgpaInput.value) || 10;
    const term = searchNameInput.value.toLowerCase().trim();

    filteredStudents = allStudents
        .map(s => {
            let score = 0;
            const nameLower = s['Student Name'].toLowerCase();
            if (term) {
                if (nameLower === term) score = 100;
                else if (nameLower.includes(term)) score = 75;
                else score = Math.max(0, 50 - levenshtein(nameLower, term));
            }
            return { ...s, matchScore: score };
        })
        .filter(s => {
            if (s.Semester === 0) return false;
            const tokens = term.split(/\s+/).filter(Boolean);
            return tokens.every(t => s['Student Name'].toLowerCase().includes(t)) &&
                   (selCourse === 'all' || s['Course Name'] === selCourse) &&
                   (selSection === 'all' || s.Section === selSection) &&
                   (selSemester === 'all' || s.Semester == selSemester) &&
                   s.CGPA >= min && s.CGPA <= max;
        });

    
    switch (sortBy.value) {
        case 'cgpa_desc': filteredStudents.sort((a,b) => b.CGPA - a.CGPA); break;
        case 'cgpa_asc': filteredStudents.sort((a,b) => a.CGPA - b.CGPA); break;
        case 'semester_desc': filteredStudents.sort((a,b) => b.Semester - a.Semester); break;
        case 'semester_asc': filteredStudents.sort((a,b) => a.Semester - b.Semester); break;
        case 'name_asc': filteredStudents.sort((a,b) => a['Student Name'].localeCompare(b['Student Name'])); break;
    }
    

    currentPage = 1;
    if (filteredStudents.length === 0) {
        noResultsDiv.classList.remove('d-none');
        leaderboardBody.innerHTML = '';
        paginationControls.classList.add('d-none');
    } else {
        noResultsDiv.classList.add('d-none');
        displayPage();
    }
    updateChart();
}

// --- EVENT LISTENERS ---
[courseFilter, sectionFilter, semesterFilter, minCgpaInput, maxCgpaInput, sortBy, searchNameInput, chartByFilter]
    .forEach(el => el && el.addEventListener('input', updateAndFilterDisplay));

resetBtn.addEventListener('click', () => {
    courseFilter.value = 'all'; sectionFilter.value = 'all'; semesterFilter.value = 'all';
    minCgpaInput.value = ''; maxCgpaInput.value = ''; searchNameInput.value = '';
    sortBy.value = 'cgpa_desc'; updateAndFilterDisplay();
});

prevPageBtn.addEventListener('click', e => { e.preventDefault(); if (currentPage > 1) { currentPage--; displayPage(); } });
nextPageBtn.addEventListener('click', e => { e.preventDefault(); const total = Math.ceil(filteredStudents.length / rowsPerPage); if (currentPage < total) { currentPage++; displayPage(); } });

goToChartBtn.addEventListener('click', () => document.getElementById('cgpaChart').scrollIntoView({ behavior: 'smooth' }));
goToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

loadData();

