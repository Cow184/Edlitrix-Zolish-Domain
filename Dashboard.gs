<style>
    /* --- DASHBOARD MASTER CSS --- */
    #dashboard-root { padding-bottom: 40px; animation: fadeIn 0.4s ease-out; }
    
    .dash-header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 25px; }
    .dash-greeting { font-size: 28px; font-weight: 700; color: var(--text-color); letter-spacing: -0.5px; line-height: 1.2; }
    .dash-greeting span { color: var(--primary-color); }
    .dash-date { font-size: 13px; color: var(--text-light); font-weight: 500; text-transform: uppercase; letter-spacing: 1px; margin-top: 5px; }
    
    /* QUICK ACTIONS */
    .quick-actions { display: flex; gap: 15px; margin-bottom: 30px; overflow-x: auto; padding-bottom: 5px; }
    .action-btn { 
        flex: 1; min-width: 150px; background: var(--primary-color); color: white; 
        padding: 15px 20px; border-radius: 12px; display: flex; align-items: center; gap: 12px; 
        cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
    }
    .action-btn:hover { transform: translateY(-3px); box-shadow: 0 6px 15px rgba(0,0,0,0.15); filter: brightness(1.1); }
    .action-btn.secondary { background: var(--bg-color); color: var(--text-color); border: 1px solid var(--ezd-border); box-shadow: 0 2px 5px rgba(0,0,0,0.02); }
    .action-btn.secondary i { color: var(--primary-color); }
    body.ezd-dark-mode .action-btn.secondary { background: #1e293b; border-color: #334155; }
    
    .action-title { font-size: 14px; font-weight: 600; }
    .action-sub { font-size: 11px; opacity: 0.8; margin-top: 2px; }

    /* MASTER GRID */
    .dash-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 25px; }
    @media (max-width: 900px) { .dash-grid { grid-template-columns: 1fr; } }

    /* CARDS */
    .dash-card { background: var(--bg-color); border-radius: 16px; border: 1px solid var(--ezd-border); padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
    body.ezd-dark-mode .dash-card { background: #1e293b; border-color: #334155; }
    
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--ezd-border); padding-bottom: 15px; }
    .card-title { font-size: 15px; font-weight: 700; color: var(--text-color); display: flex; align-items: center; gap: 8px; }
    .card-title i { color: var(--primary-color); }

    /* CALLBOARD STYLES */
    .next-event-title { font-size: 24px; font-weight: 800; color: var(--text-color); margin-bottom: 5px; }
    .next-event-meta { font-size: 13px; color: var(--text-light); display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; }
    .next-event-meta div { display: flex; align-items: center; gap: 5px; }
    
    .call-box { background: rgba(0,0,0,0.03); border: 1px solid var(--ezd-border); border-radius: 8px; padding: 15px; }
    body.ezd-dark-mode .call-box { background: rgba(0,0,0,0.2); }
    .call-label { font-size: 11px; font-weight: 700; color: var(--text-light); text-transform: uppercase; margin-bottom: 5px; }
    .call-value { font-size: 13px; color: var(--text-color); font-weight: 500; line-height: 1.5; }

    /* STATS & HEALTH */
    .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px dashed var(--ezd-border); }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { font-size: 13px; color: var(--text-light); font-weight: 500; }
    .stat-num { font-size: 16px; font-weight: 800; color: var(--text-color); }
    
    .alert-pill { background: #fee2e2; color: #b91c1c; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; }
    .good-pill { background: #dcfce7; color: #166534; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 20px; display: inline-flex; align-items: center; gap: 5px; }

    /* ACTIVITY FEED */
    .feed-list { display: flex; flex-direction: column; gap: 15px; }
    .feed-item { display: flex; gap: 12px; align-items: flex-start; }
    .feed-icon { width: 32px; height: 32px; border-radius: 50%; background: rgba(var(--primary-rgb), 0.1); color: var(--primary-color); display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }
    .feed-text { font-size: 13px; color: var(--text-color); line-height: 1.4; }
    .feed-time { font-size: 11px; color: var(--text-light); margin-top: 2px; }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>

<div id="dashboard-root">
    
    <div class="dash-header-row">
        <div>
            <div class="dash-greeting" id="dashGreeting">Welcome, <span><?= user.email.split('@')[0] ?></span></div>
            <div class="dash-date" id="dashDate">Loading Date...</div>
        </div>
        <div>
            <div class="good-pill" id="systemStatusBadge"><i class="fas fa-satellite-dish"></i> Systems Live</div>
        </div>
    </div>

    <div class="quick-actions">
        <div class="action-btn" onclick="if(typeof loadModule === 'function') loadModule('attendance');">
            <i class="fas fa-clipboard-check" style="font-size: 24px;"></i>
            <div>
                <div class="action-title">Run Attendance</div>
                <div class="action-sub">Open Smart Matrix</div>
            </div>
        </div>
        <div class="action-btn secondary" onclick="if(typeof loadModule === 'function') loadModule('people');">
            <i class="fas fa-users" style="font-size: 20px;"></i>
            <div>
                <div class="action-title">Company Roster</div>
                <div class="action-sub">Manage Profiles</div>
            </div>
        </div>
        <div class="action-btn secondary" onclick="if(typeof loadModule === 'function') loadModule('events');">
            <i class="fas fa-calendar-alt" style="font-size: 20px;"></i>
            <div>
                <div class="action-title">Schedule</div>
                <div class="action-sub">Manage Events</div>
            </div>
        </div>
    </div>

    <div class="dash-grid">
        
        <div style="display: flex; flex-direction: column; gap: 25px;">
            
            <div class="dash-card">
                <div class="card-header">
                    <div class="card-title"><i class="fas fa-bullhorn"></i> The Callboard (Up Next)</div>
                </div>
                <div id="callboardContent" style="min-height: 150px; display:flex; align-items:center; justify-content:center; color:var(--text-light);">
                    <i class="fas fa-circle-notch fa-spin"></i> &nbsp; Scanning Schedule...
                </div>
            </div>

            <div class="dash-card" id="todaySnapshotCard" style="display: none;">
                <div class="card-header" style="margin-bottom: 10px; border:none;">
                    <div class="card-title"><i class="fas fa-chart-pie"></i> Today's Live Attendance</div>
                </div>
                <div id="todaySnapshotContent"></div>
            </div>

        </div>

        <div style="display: flex; flex-direction: column; gap: 25px;">
            
            <div class="dash-card">
                <div class="card-header">
                    <div class="card-title"><i class="fas fa-heartbeat"></i> Roster Health</div>
                </div>
                <div id="rosterHealthContent" style="min-height: 100px; display:flex; align-items:center; justify-content:center; color:var(--text-light);">
                    <i class="fas fa-circle-notch fa-spin"></i> &nbsp; Analyzing Database...
                </div>
            </div>

            <div class="dash-card">
                <div class="card-header">
                    <div class="card-title"><i class="fas fa-history"></i> System Activity</div>
                </div>
                <div class="feed-list" id="activityFeedContent">
                    <div style="text-align:center; color:var(--text-light); padding: 20px 0;"><i class="fas fa-circle-notch fa-spin"></i> &nbsp; Fetching Logs...</div>
                </div>
            </div>

        </div>

    </div>

</div>

<script>
(function() {
    // 1. Set Date immediately
    var dateOpts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('dashDate').innerText = new Date().toLocaleDateString('en-US', dateOpts);

    // 2. Time formatter helper
    function formatTime(timeStr) {
        if (!timeStr) return "";
        var t = String(timeStr);
        if (t.includes('T') && t.includes('Z')) {
            var d = new Date(t);
            var h = d.getHours();
            var m = String(d.getMinutes()).padStart(2, '0');
            var ampm = h >= 12 ? 'PM' : 'AM';
            return (h % 12 || 12) + ':' + m + ' ' + ampm;
        }
        return t; 
    }

    window.DashboardModule = {
        init: function() {
            // Setup Listeners so Dashboard reacts to live data changes behind the scenes
            var self = this;
            var attemptRender = function() {
                if (window.EZD_STORE && window.EZD_STORE.coreReady) {
                    self.renderCallboard();
                    self.renderHealth();
                }
            };
            
            window.addEventListener('fdsCoreReady', attemptRender);
            window.addEventListener('fdsLiveReady', function() { self.renderSnapshot(); });
            
            // Initial attempt
            attemptRender();
            if (window.EZD_STORE && window.EZD_STORE.liveReady) this.renderSnapshot();

            // Fetch server logs asynchronously
            this.fetchLogs();
        },

        renderCallboard: function() {
            var el = document.getElementById('callboardContent');
            if(!el) return;
            
            // THE FIX: Remove the loading flexbox so it doesn't squish
            el.style.display = 'block'; 

            var events = window.EZD_STORE.events || [];
            
            var now = new Date();
            now.setHours(0,0,0,0);
            
            var upcoming = events.filter(function(e) {
                if(!e.Date) return false;
                // THE FIX: Strict Local Parsing to prevent Timezone Drift
                var pDate = String(e.Date).split('T')[0].split('-');
                var d = new Date(pDate[0], parseInt(pDate[1])-1, pDate[2]);
                d.setHours(0,0,0,0); 
                return d.getTime() >= now.getTime();
            }).sort(function(a,b) { 
                var aD = String(a.Date).split('T')[0].split('-');
                var bD = String(b.Date).split('T')[0].split('-');
                return new Date(aD[0], parseInt(aD[1])-1, aD[2]) - new Date(bD[0], parseInt(bD[1])-1, bD[2]); 
            });

            if (upcoming.length === 0) {
                el.innerHTML = '<div style="text-align:center; padding: 40px 0; color:var(--text-light);"><i class="fas fa-calendar-times" style="font-size:30px; margin-bottom:10px; opacity:0.3;"></i><br>No upcoming events scheduled.</div>';
                document.getElementById('todaySnapshotCard').style.display = 'none';
                this.nextEventId = null;
                return;
            }

            var nxt = upcoming[0];
            this.nextEventId = nxt.EventID; 

            var pDateMatch = String(nxt.Date).split('T')[0].split('-');
            var dObj = new Date(pDateMatch[0], parseInt(pDateMatch[1])-1, pDateMatch[2]);
            dObj.setHours(0,0,0,0);
            var isToday = (dObj.getTime() === now.getTime());
            
            var dateString = isToday ? '<span style="color:#10b981; font-weight:bold;">TODAY</span>' : dObj.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
            var timeString = formatTime(nxt.StartTime) + ' - ' + formatTime(nxt.EndTime);
            var locString = nxt.Location || 'TBD';

            var safeJoin = function(val) {
                try {
                    if (Array.isArray(val)) return val.join(', ');
                    if (val && val.startsWith('[')) return JSON.parse(val).join(', ');
                    return val || 'None';
                } catch(e) { return val || 'None'; }
            };

            var html = '';
            html += '<div class="next-event-title">' + (nxt.Title || 'Unnamed Event') + '</div>';
            html += '<div class="next-event-meta">';
            html += '<div><i class="fas fa-calendar-day"></i> ' + dateString + '</div>';
            html += '<div><i class="fas fa-clock"></i> ' + timeString + '</div>';
            html += '<div><i class="fas fa-map-marker-alt"></i> ' + locString + '</div>';
            html += '</div>';

            html += '<div class="call-box">';
            html += '<div class="call-label">Who is Called:</div>';
            html += '<div class="call-value"><b>Groups:</b> ' + safeJoin(nxt.RequiredGroups) + '</div>';
            html += '<div class="call-value" style="margin-top:4px;"><b>Roles:</b> ' + safeJoin(nxt.RequiredRoles) + '</div>';
            html += '<div class="call-value" style="margin-top:4px;"><b>Specific:</b> ' + safeJoin(nxt.RequiredCharacters) + '</div>';
            html += '</div>';

            el.innerHTML = html;
            
            if (isToday) {
                document.getElementById('todaySnapshotCard').style.display = 'block';
                this.renderSnapshot();
            } else {
                document.getElementById('todaySnapshotCard').style.display = 'none';
            }
        },

        renderSnapshot: function() {
            if (!this.nextEventId) return;
            var el = document.getElementById('todaySnapshotContent');
            if (!el) return;

            var attendance = window.EZD_STORE.attendance || [];
            var people = window.EZD_STORE.people || [];
            
            // We only count people who have a record for this specific event in the Matrix
            var pCount = 0, lCount = 0, aCount = 0, mCount = 0;
            var totalCount = 0;

            attendance.forEach(function(a) {
                if (a.EventID === window.DashboardModule.nextEventId) {
                    totalCount++;
                    if (a.Status === 'Present' || a.Status === 'Checked Out') pCount++;
                    else if (a.Status === 'Late') lCount++;
                    else if (a.Status === 'Absent' || a.Status === 'Excused') aCount++;
                    else mCount++; // Missing or empty
                }
            });

            if (totalCount === 0) {
                el.innerHTML = '<div style="font-size:12px; color:var(--text-light); text-align:center; padding:10px 0;">No attendance generated yet.</div>';
                return;
            }

            var pPct = Math.round((pCount / totalCount) * 100) || 0;
            var lPct = Math.round((lCount / totalCount) * 100) || 0;
            var aPct = Math.round((aCount / totalCount) * 100) || 0;
            var mPct = Math.round((mCount / totalCount) * 100) || 0;

            var html = '<div style="display:flex; height:12px; border-radius:6px; overflow:hidden; margin-bottom:15px; border:1px solid var(--ezd-border);">';
            if (pPct > 0) html += '<div style="width:' + pPct + '%; background:#10b981;" title="Present"></div>';
            if (lPct > 0) html += '<div style="width:' + lPct + '%; background:#f59e0b;" title="Issues"></div>';
            if (aPct > 0) html += '<div style="width:' + aPct + '%; background:#ef4444;" title="Absent"></div>';
            if (mPct > 0) html += '<div style="width:' + mPct + '%; background:#cbd5e1;" title="Missing"></div>';
            html += '</div>';

            html += '<div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap:10px; text-align:center;">';
            html += '<div><div style="font-size:18px; font-weight:800; color:#10b981;">' + pCount + '</div><div style="font-size:9px; font-weight:700; color:var(--text-light); text-transform:uppercase;">Present</div></div>';
            html += '<div><div style="font-size:18px; font-weight:800; color:#f59e0b;">' + lCount + '</div><div style="font-size:9px; font-weight:700; color:var(--text-light); text-transform:uppercase;">Late</div></div>';
            html += '<div><div style="font-size:18px; font-weight:800; color:#ef4444;">' + aCount + '</div><div style="font-size:9px; font-weight:700; color:var(--text-light); text-transform:uppercase;">Absent</div></div>';
            html += '<div><div style="font-size:18px; font-weight:800; color:#64748b;">' + mCount + '</div><div style="font-size:9px; font-weight:700; color:var(--text-light); text-transform:uppercase;">Missing</div></div>';
            html += '</div>';

            el.innerHTML = html;
        },

        renderHealth: function() {
            var el = document.getElementById('rosterHealthContent');
            if (!el) return;
            
            // THE FIX: Remove the loading flexbox so it drops back to vertical stacking
            el.style.display = 'block'; 

            var people = window.EZD_STORE.people || [];
            
            var total = people.length;
            var active = 0;
            var cast = 0;
            var crew = 0;
            var missingEmergency = 0;

            people.forEach(function(p) {
                if (p.Status !== 'Archived' && p.Status !== 'Alumni') {
                    active++;
                    if (String(p.Role).toLowerCase().includes('actor')) cast++;
                    if (String(p.Role).toLowerCase().includes('crew') || String(p.Role).toLowerCase().includes('tech')) crew++;
                    
                    // Emergency Alert (Only check Active personnel)
                    if (!p.EmergencyContact1 || !p.EmergencyPhone1) missingEmergency++;
                }
            });

            var html = '';
            
            html += '<div class="stat-row">';
            html += '<span class="stat-label">Total Personnel</span>';
            html += '<span class="stat-num">' + total + '</span>';
            html += '</div>';

            html += '<div class="stat-row">';
            html += '<span class="stat-label">Active Cast</span>';
            html += '<span class="stat-num">' + cast + '</span>';
            html += '</div>';

            html += '<div class="stat-row">';
            html += '<span class="stat-label">Active Tech/Crew</span>';
            html += '<span class="stat-num">' + crew + '</span>';
            html += '</div>';

            html += '<div class="stat-row" style="margin-top:10px;">';
            if (missingEmergency > 0) {
                html += '<span class="alert-pill"><i class="fas fa-exclamation-triangle"></i> ' + missingEmergency + ' Missing Emergency Contacts</span>';
            } else {
                html += '<span class="good-pill"><i class="fas fa-check-circle"></i> Profiles 100% Complete</span>';
            }
            html += '</div>';

            el.innerHTML = html;
        },

        fetchLogs: function() {
            var el = document.getElementById('activityFeedContent');
            google.script.run.withSuccessHandler(function(logs) {
                if (!logs || logs.length === 0) {
                    el.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-light);">No recent activity.</div>';
                    return;
                }

                var html = '';
                logs.forEach(function(log) {
                    var icon = 'fa-history';
                    var colorClass = '';
                    var actionLower = log.Action.toLowerCase();
                    
                    if (actionLower.includes('update') || actionLower.includes('edit')) { icon = 'fa-pen'; }
                    if (actionLower.includes('add') || actionLower.includes('create')) { icon = 'fa-plus'; colorClass = 'color:#10b981; background:#dcfce7;'; }
                    if (actionLower.includes('delete') || actionLower.includes('archive')) { icon = 'fa-trash'; colorClass = 'color:#ef4444; background:#fee2e2;'; }
                    if (actionLower.includes('sync') || actionLower.includes('backup')) { icon = 'fa-server'; colorClass = 'color:#3b82f6; background:#dbeafe;'; }

                    html += '<div class="feed-item">';
                    html += '<div class="feed-icon" style="' + colorClass + '"><i class="fas ' + icon + '"></i></div>';
                    html += '<div>';
                    html += '<div class="feed-text"><b>' + log.User + '</b> ' + log.Action + (log.Detail ? ' (' + log.Detail + ')' : '') + '</div>';
                    html += '<div class="feed-time">' + log.Timestamp + '</div>';
                    html += '</div></div>';
                });
                el.innerHTML = html;

            }).getRecentSystemLogs();
        }
    };

    // Boot
    setTimeout(function() { window.DashboardModule.init(); }, 100);
})();
</script>
