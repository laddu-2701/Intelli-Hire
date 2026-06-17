// Theme toggle with persistence
(function () {
    const body = document.body;
    const modeToggle = document.getElementById('modeToggle');
    const storedTheme = localStorage.getItem('theme');

    if (storedTheme === 'light') {
        body.classList.remove('theme-dark');
        body.classList.add('theme-light');
    }

    modeToggle?.addEventListener('click', () => {
        const isDark = body.classList.contains('theme-dark');
        body.classList.toggle('theme-dark', !isDark);
        body.classList.toggle('theme-light', isDark);
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
    });
})();

// Simple auth modal + localStorage token handling
(function () {
    const overlay = document.getElementById('authModal');
    const closeBtn = document.getElementById('authClose');
    const tabs = document.querySelectorAll('.auth-tab');
    const form = document.getElementById('authForm');
    const nameField = document.getElementById('authNameField');
    const fullNameInput = document.getElementById('authFullName');
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    const errorEl = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmit');

    if (!overlay || !form) return;

    let mode = 'login';

    const openModal = (nextMode) => {
        mode = nextMode || 'login';
        overlay.classList.add('visible');
        overlay.setAttribute('aria-hidden', 'false');
        errorEl.textContent = '';
        if (mode === 'signup') {
            nameField.style.display = '';
        } else {
            nameField.style.display = 'none';
        }
        tabs.forEach((t) => {
            t.classList.toggle('auth-tab-active', t.dataset.authMode === mode);
        });
    };

    const closeModal = () => {
        overlay.classList.remove('visible');
        overlay.setAttribute('aria-hidden', 'true');
    };

    document.querySelectorAll('[data-auth-trigger]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const triggerMode = btn.getAttribute('data-auth-trigger') || 'login';
            openModal(triggerMode);
        });
    });

    closeBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const tabMode = tab.dataset.authMode || 'login';
            openModal(tabMode);
        });
    });

    const saveAuth = (payload) => {
        if (!payload) return;
        try {
            localStorage.setItem('intellihire_token', payload.token);
            localStorage.setItem('intellihire_user', JSON.stringify(payload.user));
        } catch {
            // ignore storage errors
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        errorEl.textContent = '';

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const fullName = fullNameInput.value.trim();

        if (!email || !password) {
            errorEl.textContent = 'Email and password are required.';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Please wait...';

        const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
        const body = mode === 'signup'
            ? { email, password, full_name: fullName || undefined }
            : { email, password };

        fetch('http://127.0.0.1:8000' + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
            .then((res) => (res.ok ? res.json() : res.json().then((d) => Promise.reject(d))))
            .then((data) => {
                saveAuth(data);
                closeModal();
                // After login/signup, redirect to dashboard
                if (!window.location.pathname.endsWith('dashboard.html')) {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.reload();
                }
            })
            .catch((err) => {
                const msg = (err && err.detail) || 'Authentication failed. Please try again.';
                errorEl.textContent = msg;
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Continue';
            });
    };

    form.addEventListener('submit', handleSubmit);

    let dropdownDismissInitialized = false;

    const initDropdownDismissListener = () => {
        if (dropdownDismissInitialized) return;
        dropdownDismissInitialized = true;
        document.addEventListener('click', (event) => {
            document.querySelectorAll('.nav-profile-menu.visible').forEach((menu) => {
                const profileBtn = menu.previousElementSibling;
                const target = event.target;
                if (profileBtn && (profileBtn.contains(target) || menu.contains(target))) {
                    return;
                }
                menu.classList.remove('visible');
                if (profileBtn) profileBtn.classList.remove('open');
            });
        });
    };

    const updateNavAuthState = () => {
        let user = null;
        try {
            const stored = localStorage.getItem('intellihire_user');
            if (stored) user = JSON.parse(stored);
        } catch {
            user = null;
        }

        document.querySelectorAll('.nav-actions').forEach((nav) => {
            const authButtons = nav.querySelectorAll('[data-auth-trigger]');
            let profile = nav.querySelector('.nav-profile');
            let menu = nav.querySelector('.nav-profile-menu');

            if (user) {
                authButtons.forEach((btn) => {
                    btn.style.display = 'none';
                });

                if (!profile) {
                    profile = document.createElement('button');
                    profile.type = 'button';
                    profile.className = 'nav-profile';
                    const avatar = document.createElement('div');
                    avatar.className = 'nav-profile-avatar';
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'nav-profile-name';
                    const arrow = document.createElement('span');
                    arrow.className = 'nav-profile-arrow';
                    arrow.textContent = '▾';
                    profile.appendChild(avatar);
                    profile.appendChild(nameSpan);
                    profile.appendChild(arrow);
                    nav.appendChild(profile);
                } else if (!profile.querySelector('.nav-profile-arrow')) {
                    const arrow = document.createElement('span');
                    arrow.className = 'nav-profile-arrow';
                    arrow.textContent = '▾';
                    profile.appendChild(arrow);
                }

                const initials = (user.full_name || user.email || '?')
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((s) => s[0]?.toUpperCase() || '')
                    .join('') || '?';

                const avatarEl = profile.querySelector('.nav-profile-avatar');
                const nameEl = profile.querySelector('.nav-profile-name');
                if (avatarEl) avatarEl.textContent = initials;
                if (nameEl) nameEl.textContent = user.full_name || user.email;

                if (!menu) {
                    menu = document.createElement('div');
                    menu.className = 'nav-profile-menu';
                    const logoutBtn = document.createElement('button');
                    logoutBtn.type = 'button';
                    logoutBtn.className = 'nav-profile-menu-item';
                    logoutBtn.textContent = 'Log out';
                    logoutBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        localStorage.removeItem('intellihire_token');
                        localStorage.removeItem('intellihire_user');
                        window.location.href = 'index.html';
                    });
                    menu.appendChild(logoutBtn);
                    nav.appendChild(menu);
                }

                initDropdownDismissListener();

                profile.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!menu) return;
                    const isOpen = menu.classList.toggle('visible');
                    profile.classList.toggle('open', isOpen);
                };
            } else {
                authButtons.forEach((btn) => {
                    btn.style.display = '';
                });
                if (profile) {
                    profile.remove();
                }
                if (menu) {
                    menu.remove();
                }
            }
        });
    };

    // Run once on load to sync UI with existing session
    updateNavAuthState();
})();

// Smooth scroll for CTA buttons
(function () {
    document.querySelectorAll('[data-scroll-target]').forEach((el) => {
        el.addEventListener('click', () => {
            const targetSel = el.getAttribute('data-scroll-target');
            if (!targetSel) return;
            const target = document.querySelector(targetSel);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
})();

// Hero upload area: drag & drop + call backend parsing API (with graceful fallback)
(function () {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const fileProgressList = document.getElementById('fileProgressList');
    const pipelineStatus = document.getElementById('pipelineStatus');
    const pipelineSteps = Array.from(document.querySelectorAll('.pipeline-step'));

    if (!uploadArea || !fileInput || !fileProgressList) return;

    const setStatus = (status) => {
        if (!pipelineStatus) return;
        pipelineStatus.textContent = status;
    };

    const resetPipeline = () => {
        pipelineSteps.forEach((step) => {
            step.classList.remove('active', 'completed');
        });
    };

    const runPipelineAnimation = () => {
        resetPipeline();
        const totalSteps = pipelineSteps.length;
        let index = 0;
        setStatus('Processing');

        const advance = () => {
            if (index > 0) {
                pipelineSteps[index - 1].classList.remove('active');
                pipelineSteps[index - 1].classList.add('completed');
            }
            if (index < totalSteps) {
                pipelineSteps[index].classList.add('active');
                index += 1;
                setTimeout(advance, 600);
            } else {
                setStatus('Complete');
            }
        };

        advance();
    };

    const renderEmptyState = () => {
        fileProgressList.innerHTML = '<p class="empty-state">No resumes uploaded yet.</p>';
    };

    const handleFiles = (files) => {
        if (!files || !files.length) return;

        if (fileProgressList.querySelector('.empty-state')) {
            fileProgressList.innerHTML = '';
        }

        runPipelineAnimation();

        const filesArray = Array.from(files).slice(0, 10);

        // UI progress simulation
        filesArray.forEach((file, idx) => {
            const row = document.createElement('div');
            row.className = 'file-row';

            const name = document.createElement('div');
            name.className = 'file-name';
            name.textContent = file.name;

            const progressTrack = document.createElement('div');
            progressTrack.className = 'progress-track';

            const progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            progressTrack.appendChild(progressFill);

            const status = document.createElement('div');
            status.className = 'file-status';
            status.textContent = 'Queued';

            row.appendChild(name);
            row.appendChild(progressTrack);
            row.appendChild(status);
            fileProgressList.appendChild(row);

            // simulate progress
            const duration = 2500 + idx * 400;
            const start = performance.now();

            const tick = (now) => {
                const elapsed = now - start;
                const pct = Math.min(100, (elapsed / duration) * 100);
                progressFill.style.width = pct.toFixed(0) + '%';

                if (pct < 100) {
                    status.textContent = `Parsing ${pct.toFixed(0)}%`;
                    requestAnimationFrame(tick);
                } else {
                    status.textContent = 'Parsed successfully';
                }
            };

            requestAnimationFrame(tick);
        });

        // Try sending to backend API (non-blocking for UI)
        const formData = new FormData();
        filesArray.forEach((file) => {
            formData.append('files', file, file.name);
        });

        fetch('http://127.0.0.1:8000/api/resumes/upload', {
            method: 'POST',
            body: formData,
        })
            .then((res) => (res.ok ? res.json() : Promise.reject(res)))
            .then((data) => {
                // Optional: log or later wire to dashboard table
                console.log('Parsed candidates from backend:', data);
            })
            .catch(() => {
                // Fail silently so demo still works without backend
            });
    };

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const dt = e.dataTransfer;
        if (dt && dt.files) {
            handleFiles(dt.files);
        }
    });

    uploadArea.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
        fileInput.value = '';
    });

    renderEmptyState();
})();

// Candidate dashboard: live data from backend with fallback mock
(function () {
    const searchInput = document.getElementById('searchInput');
    const minScoreInput = document.getElementById('minScore');
    const minScoreValue = document.getElementById('minScoreValue');
    const sortBySelect = document.getElementById('sortBy');
    const tableBody = document.getElementById('candidateTableBody');
    const totalCandidatesEl = document.getElementById('totalCandidates');
    const visibleCandidatesEl = document.getElementById('visibleCandidates');
    const highMatchBar = document.getElementById('highMatchBar');
    const mediumMatchBar = document.getElementById('mediumMatchBar');
    const lowMatchBar = document.getElementById('lowMatchBar');
    const factorListEl = document.getElementById('candidateFactorList');
    const improvementsEl = document.getElementById('candidateImprovements');

    if (!tableBody) return;

    // Gate dashboard: require a token in localStorage
    if (window.location.pathname.endsWith('dashboard.html')) {
        const token = localStorage.getItem('intellihire_token');
        if (!token) {
            // Not logged in: open login modal or redirect home
            window.location.href = 'index.html#login-required';
            return;
        }
    }

    let candidates = [];

    const state = {
        query: '',
        minScore: parseInt(minScoreInput?.value || '50', 10),
        sortBy: sortBySelect?.value || 'score',
    };

    const applyFiltersAndSort = () => {
        let result = candidates.slice();

        if (state.query) {
            const q = state.query.toLowerCase();
            result = result.filter((c) => {
                const inName = c.name.toLowerCase().includes(q);
                const inSkills = (c.skills || []).join(' ').toLowerCase().includes(q);
                return inName || inSkills;
            });
        }

        result = result.filter((c) => (c.relevance_score ?? c.score ?? 0) >= state.minScore);

        if (state.sortBy === 'score') {
            result.sort((a, b) => (b.relevance_score ?? b.score ?? 0) - (a.relevance_score ?? a.score ?? 0));
        } else if (state.sortBy === 'experience') {
            result.sort((a, b) => (b.experience_years ?? b.experienceYears ?? 0) - (a.experience_years ?? a.experienceYears ?? 0));
        } else if (state.sortBy === 'name') {
            result.sort((a, b) => a.name.localeCompare(b.name));
        }

        return result;
    };

    const renderSummaryBars = (list) => {
        if (!highMatchBar || !mediumMatchBar || !lowMatchBar) return;
        const total = list.length || 1;
        const high = list.filter((c) => (c.relevance_score ?? c.score ?? 0) >= 80).length;
        const medium = list.filter((c) => {
            const s = c.relevance_score ?? c.score ?? 0;
            return s >= 60 && s < 80;
        }).length;
        const low = list.filter((c) => (c.relevance_score ?? c.score ?? 0) < 60).length;

        highMatchBar.style.width = ((high / total) * 100).toFixed(0) + '%';
        mediumMatchBar.style.width = ((medium / total) * 100).toFixed(0) + '%';
        lowMatchBar.style.width = ((low / total) * 100).toFixed(0) + '%';
    };

    const renderTable = () => {
        const list = applyFiltersAndSort();
        tableBody.innerHTML = '';

        if (!list.length) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 7;
            td.textContent = 'No candidates available yet. Upload resumes from the home page.';
            td.style.fontSize = '0.8rem';
            td.style.color = '#9ca3af';
            tr.appendChild(td);
            tableBody.appendChild(tr);
            if (totalCandidatesEl) totalCandidatesEl.textContent = String(candidates.length);
            if (visibleCandidatesEl) visibleCandidatesEl.textContent = '0';
            renderSummaryBars([]);
            return;
        }

        list.forEach((c, index) => {
            const tr = document.createElement('tr');

            const overall = c.relevance_score ?? c.score ?? 0;

            const rankTd = document.createElement('td');
            rankTd.textContent = String(c.rank ?? index + 1);

            const nameTd = document.createElement('td');
            nameTd.textContent = c.name;

            const skillsTd = document.createElement('td');
            skillsTd.textContent = (c.skills || []).slice(0, 4).join(', ');

            const expTd = document.createElement('td');
            const expYears = c.experience_years ?? c.experienceYears ?? 0;
            expTd.textContent = `${expYears} yrs`;

            const scoreTd = document.createElement('td');
            const wrapper = document.createElement('div');
            wrapper.className = 'candidate-score-pill';

            const scoreText = document.createElement('span');
            scoreText.textContent = `${overall.toFixed(0)}`;

            const bar = document.createElement('div');
            bar.className = 'candidate-score-bar';

            const fill = document.createElement('div');
            fill.className = 'candidate-score-bar-fill';
            fill.style.width = `${Math.max(0, Math.min(100, overall))}%`;

            bar.appendChild(fill);
            wrapper.appendChild(scoreText);
            wrapper.appendChild(bar);
            scoreTd.appendChild(wrapper);

            const breakdownTd = document.createElement('td');
            breakdownTd.style.fontSize = '0.72rem';
            breakdownTd.style.lineHeight = '1.2';
            const skillsScore = Math.round(c.skills_score ?? 0);
            const eduScore = Math.round(c.education_score ?? 0);
            const projScore = Math.round(c.projects_score ?? 0);
            const expScore = Math.round(c.experience_score ?? 0);
            const semScore = Math.round(c.semantic_score ?? 0);
            breakdownTd.textContent = `Skills ${skillsScore} · Edu ${eduScore} · Proj ${projScore} · Exp ${expScore} · Match ${semScore}`;

            const actionsTd = document.createElement('td');
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.textContent = 'Remove';
            deleteBtn.className = 'ghost-btn';
            deleteBtn.style.padding = '0.25rem 0.6rem';
            deleteBtn.style.fontSize = '0.7rem';
            deleteBtn.addEventListener('click', () => {
                if (!c.id) return;
                if (!window.confirm(`Remove candidate "${c.name}" from this list?`)) {
                    return;
                }
                fetch(`http://127.0.0.1:8000/api/candidates/${c.id}`, {
                    method: 'DELETE',
                })
                    .then((res) => {
                        if (!res.ok) return Promise.reject(res);
                        return res.json();
                    })
                    .then(() => {
                        candidates = candidates.filter((cand) => cand.id !== c.id);
                        renderTable();
                    })
                    .catch((err) => {
                        console.error('Failed to delete candidate:', err);
                    });
            });
            actionsTd.appendChild(deleteBtn);

            tr.appendChild(rankTd);
            tr.appendChild(nameTd);
            tr.appendChild(skillsTd);
            tr.appendChild(expTd);
            tr.appendChild(scoreTd);
            tr.appendChild(breakdownTd);
            tr.appendChild(actionsTd);
            tableBody.appendChild(tr);

            // When a row is clicked (not the remove button), show factor breakdown and improvements.
            tr.addEventListener('click', (event) => {
                if (event.target === deleteBtn) return;

                if (!factorListEl || !improvementsEl) return;

                const details = c.factor_details || null;

                // Build factor rows
                factorListEl.innerHTML = '';
                const factorsOrder = ['skills', 'education', 'projects', 'experience', 'semantic'];
                const fallbackLabels = {
                    skills: 'Skills',
                    education: 'Education',
                    projects: 'Projects',
                    experience: 'Experience',
                    semantic: 'Semantic match',
                };

                const improvements = [];

                factorsOrder.forEach((key) => {
                    const fd = details && details[key] ? details[key] : null;
                    const row = document.createElement('div');
                    row.className = 'candidate-factor-row';

                    const nameEl = document.createElement('div');
                    nameEl.className = 'candidate-factor-name';
                    nameEl.textContent = (fd && fd.label) || fallbackLabels[key];

                    const descEl = document.createElement('div');
                    descEl.className = 'candidate-factor-desc';
                    if (fd && fd.description) {
                        descEl.textContent = fd.description;
                    } else {
                        // Fallback short description based on scores
                        const scoreMap = {
                            skills: c.skills_score,
                            education: c.education_score,
                            projects: c.projects_score,
                            experience: c.experience_score,
                            semantic: c.semantic_score,
                        };
                        const val = Math.round(scoreMap[key] ?? 0);
                        descEl.textContent = val > 0
                            ? 'This factor contributed positively to the score.'
                            : 'This factor had little or no impact on the score.';
                    }

                    const badge = document.createElement('span');
                    badge.className = 'candidate-factor-badge';
                    const ok = fd ? !!fd.ok : ((key === 'skills' ? (c.skills_score ?? 0) : (key === 'education' ? (c.education_score ?? 0) : (key === 'projects' ? (c.projects_score ?? 0) : (key === 'experience' ? (c.experience_score ?? 0) : (c.semantic_score ?? 0))))) > 3);
                    badge.classList.add(ok ? 'good' : 'bad');
                    badge.textContent = ok ? 'Strong' : 'Needs work';

                    if (!ok) {
                        const imp = fd && fd.improvement ? fd.improvement : null;
                        if (imp) {
                            improvements.push(imp);
                        }
                    }

                    row.appendChild(nameEl);
                    row.appendChild(descEl);
                    row.appendChild(badge);
                    factorListEl.appendChild(row);
                });

                // Build improvements box
                improvementsEl.innerHTML = '';
                const title = document.createElement('div');
                title.className = 'candidate-improvements-title';
                title.textContent = improvements.length ? 'Improvements to consider' : 'No critical improvements detected';
                improvementsEl.appendChild(title);

                if (improvements.length) {
                    const ul = document.createElement('ul');
                    ul.className = 'candidate-improvements-list';
                    improvements.forEach((txt) => {
                        const li = document.createElement('li');
                        li.textContent = txt;
                        ul.appendChild(li);
                    });
                    improvementsEl.appendChild(ul);
                }
            });
        });

        if (totalCandidatesEl) totalCandidatesEl.textContent = String(candidates.length);
        if (visibleCandidatesEl) visibleCandidatesEl.textContent = String(list.length);
        renderSummaryBars(list);
    };

    searchInput?.addEventListener('input', (e) => {
        state.query = e.target.value.trim();
        renderTable();
    });

    minScoreInput?.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10) || 0;
        state.minScore = value;
        if (minScoreValue) minScoreValue.textContent = String(value);
        renderTable();
    });

    sortBySelect?.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        renderTable();
    });

    const loadFromBackend = () => {
        fetch('http://127.0.0.1:8000/api/candidates')
            .then((res) => (res.ok ? res.json() : Promise.reject(res)))
            .then((data) => {
                candidates = Array.isArray(data) ? data : [];
                renderTable();
                // Reset explanation panel when list reloads
                if (factorListEl) {
                    factorListEl.innerHTML = '<p class="candidate-explanation-text">Select a candidate row to see how the parser broke down their score across factors.</p>';
                }
                if (improvementsEl) {
                    improvementsEl.innerHTML = '';
                }
            })
            .catch((err) => {
                console.error('Failed to load candidates from backend:', err);
                candidates = [];
                renderTable();
                if (factorListEl) {
                    factorListEl.innerHTML = '<p class="candidate-explanation-text">No candidates available yet. Upload resumes from the home page to see explanations and tips.</p>';
                }
                if (improvementsEl) {
                    improvementsEl.innerHTML = '';
                }
            });
    };

    const clearBtn = document.getElementById('clearCandidatesBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (!window.confirm('Clear all candidates from this demo dashboard? This cannot be undone.')) {
                return;
            }
            fetch('http://127.0.0.1:8000/api/candidates', {
                method: 'DELETE',
            })
                .then((res) => {
                    if (!res.ok) {
                        return Promise.reject(res);
                    }
                    return res.json();
                })
                .then(() => {
                    candidates = [];
                    renderTable();
                })
                .catch((err) => {
                    console.error('Failed to clear candidates:', err);
                    candidates = [];
                    renderTable();
                });
        });
    }

    loadFromBackend();
})();

// Footer year
(function () {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
