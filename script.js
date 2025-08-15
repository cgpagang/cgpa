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

let allStudents = [];
let filteredStudents = [];
let currentPage = 1;
const rowsPerPage = 100;

// --- DATA UTILITIES ---
function convertSemester(semesterStr) {
    if (!semesterStr) return 0;
    const str = String(semesterStr).toUpperCase().trim();
    if (!isNaN(parseInt(str))) return parseInt(str, 10);
    const romanMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10 };
    return romanMap[str] || 0;
}

/**
 * Returns a CSS class based on the student's CGPA.
 * @param {number} gpa The student's CGPA.
 * @returns {string} The CSS class for the row color.
 */
function getGpaClass(gpa) {
    if (gpa >= 9) return 'gpa-high';
    if (gpa >= 7) return 'gpa-good';
    if (gpa >= 6) return 'gpa-mid';
    if (gpa >= 4) return 'gpa-low';
    return 'gpa-fail';
}

// --- DATA FETCHING & INITIALIZATION ---
function loadData() {
    Papa.parse(CSV_FILE_PATH, {
        download: true, header: true, skipEmptyLines: true,
        complete: (results) => {
            allStudents = results.data.map(student => ({
                ...student,
                'Student Name': student['Student Name'] ? student['Student Name'].trim() : 'N/A',
                'Course Name': student['Course Name'] ? student['Course Name'].trim() : 'N/A',
                Section: student.Section ? student.Section.trim() : 'N/A',
                Semester: convertSemester(student.Semester),
                CGPA: parseFloat(student.CGPA) || 0
            }));
            populateFilters();
            updateAndFilterDisplay();
        },
        error: (err) => {
            console.error("Error loading or parsing CSV file:", err);
            leaderboardBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-danger"><strong>Error:</strong> Could not load student data.</td></tr>`;
        }
    });
}

// --- FILTER POPULATION ---
function populateFilters() {
    const courses = [...new Set(allStudents.map(s => s['Course Name']))].sort();
    const sections = [...new Set(allStudents.map(s => s.Section))].sort();
    const semesters = [...new Set(allStudents.map(s => s.Semester))].filter(s => s > 0).sort((a,b) => a - b);
    const addOptions = (selectElement, options) => {
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option; opt.textContent = option; selectElement.appendChild(opt);
        });
    };
    addOptions(courseFilter, courses);
    addOptions(sectionFilter, sections);
    addOptions(semesterFilter, semesters);
}

// --- DISPLAY LOGIC ---
function displayPage() {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

    leaderboardBody.innerHTML = ''; 
    paginatedStudents.forEach((student, index) => {
        const rank = startIndex + index + 1;
        const row = document.createElement('tr');
        
        // Set the row's class based on CGPA
        row.className = getGpaClass(student.CGPA);

        row.innerHTML = `
            <td class="px-4 py-3 fw-medium">${rank}</td>
            <td class="px-4 py-3 fw-semibold">${student['Student Name']}</td>
            <td class="px-4 py-3">${student['Course Name']}</td>
            <td class="px-4 py-3">${student.Section}</td>
            <td class="px-4 py-3">${student.Semester}</td>
            <td class="px-4 py-3 text-end fw-bold text-primary">${student.CGPA.toFixed(2)}</td>
        `;
        leaderboardBody.appendChild(row);
    });
    setupPagination();
}

function setupPagination() {
    const totalPages = Math.ceil(filteredStudents.length / rowsPerPage);

    if (totalPages <= 1) {
        paginationControls.classList.add('d-none');
    } else {
        paginationControls.classList.remove('d-none');
    }

    pageInfoDiv.textContent = `Page ${currentPage} of ${totalPages}`;
    prevBtnLi.classList.toggle('disabled', currentPage === 1);
    nextBtnLi.classList.toggle('disabled', currentPage === totalPages);
}

function updateAndFilterDisplay() {
    const selectedCourse = courseFilter.value;
    const selectedSection = sectionFilter.value;
    const selectedSemester = semesterFilter.value;
    const minCgpa = parseFloat(minCgpaInput.value) || 0;
    const maxCgpa = parseFloat(maxCgpaInput.value) || 10;
    const searchTerm = searchNameInput.value.toLowerCase().trim();

    filteredStudents = allStudents.filter(s => {
        if (s.Semester === 0) return false;
        const nameMatch = s['Student Name'].toLowerCase().includes(searchTerm);
        const courseMatch = selectedCourse === 'all' || s['Course Name'] === selectedCourse;
        const sectionMatch = selectedSection === 'all' || s.Section === selectedSection;
        const semesterMatch = selectedSemester === 'all' || s.Semester == selectedSemester;
        const cgpaMatch = s.CGPA >= minCgpa && s.CGPA <= maxCgpa;
        return nameMatch && courseMatch && sectionMatch && semesterMatch && cgpaMatch;
    });

    const sortValue = sortBy.value;
    switch (sortValue) {
        case 'cgpa_desc': filteredStudents.sort((a, b) => b.CGPA - a.CGPA); break;
        case 'cgpa_asc': filteredStudents.sort((a, b) => a.CGPA - b.CGPA); break;
        case 'semester_desc': filteredStudents.sort((a, b) => b.Semester - a.Semester); break;
        case 'semester_asc': filteredStudents.sort((a, b) => a.Semester - b.Semester); break;
        case 'name_asc': filteredStudents.sort((a, b) => a['Student Name'].localeCompare(b['Student Name'])); break;
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
}

// --- EVENT LISTENERS ---
const allFilters = [courseFilter, sectionFilter, semesterFilter, minCgpaInput, maxCgpaInput, sortBy, searchNameInput];
allFilters.forEach(el => el.addEventListener('input', updateAndFilterDisplay));

resetBtn.addEventListener('click', () => {
    courseFilter.value = 'all'; sectionFilter.value = 'all'; semesterFilter.value = 'all';
    minCgpaInput.value = ''; maxCgpaInput.value = '';
    searchNameInput.value = '';
    sortBy.value = 'cgpa_desc';
    updateAndFilterDisplay();
});

prevPageBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentPage > 1) {
        currentPage--;
        displayPage();
    }
});

nextPageBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const totalPages = Math.ceil(filteredStudents.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayPage();
    }
});

loadData();
