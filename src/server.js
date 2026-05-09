const http = require('node:http')
const { loadSnapshot } = require('./data-sources.js')

const HOST = process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.PORT || 4387)

function renderHtml(snapshot) {
  const metricCards = [
    ['Memory events', snapshot.summary.totalMemoryEvents],
    ['Archived tasks', snapshot.summary.totalArchivedTasks],
    ['Skills', snapshot.summary.totalSkills]
  ].map(([label, value]) => `<div class="card"><strong>${value}</strong><span>${label}</span></div>`).join('')

  const boundary = snapshot.boundary || {
    memory: { activeDays: 0, sources: [] },
    history: { recentProjects: [], latestOutcome: null },
    skills: { topCategories: [], densestCategory: null }
  }
  const visualization = snapshot.visualization || {
    memoryByDay: [],
    historyByType: [],
    skillCategoryBreakdown: []
  }
  const dataSources = snapshot.dataSources || {
    memory: { path: 'Not configured', dailyNotes: 0, latestDate: null },
    history: { path: 'Not configured', archivedTasks: 0, latestCompletedOn: null },
    skills: { path: 'Not configured', skillCount: 0, categoryCount: 0, densestCategory: null }
  }
  const boundarySources = boundary.memory.sources.length
    ? boundary.memory.sources.map((entry) => `${entry.source} (${entry.count})`).join(', ')
    : 'No memory sources yet.'
  const boundaryProjects = boundary.history.recentProjects.length
    ? boundary.history.recentProjects.join(', ')
    : 'No archived projects yet.'
  const boundaryCategories = boundary.skills.topCategories.length
    ? boundary.skills.topCategories.map((entry) => `${entry.category} (${entry.count})`).join(', ')
    : 'No skill categories yet.'

  const timelineItems = snapshot.timeline.map((entry) => `<li><strong>${entry.date}${entry.time ? ` ${entry.time}` : ''}</strong> · ${entry.source}<br>${entry.summary}</li>`).join('')
  const archivedItems = snapshot.archivedHistory.slice(0, 8).map((task) => `<li><strong>${task.project}</strong> · ${task.completed_on}<br>${task.outcome}<br><small>${task.verification}</small></li>`).join('')
  const skillGroups = snapshot.skillsByCategory.map((group) => `<section class="group"><h3>${group.category} <small>${group.count}</small></h3><ul>${group.skills.map((skill) => `<li><strong>${skill.name}</strong><br><small>${skill.description}</small></li>`).join('')}</ul></section>`).join('')
  const wrapperSurfaceCards = [
    {
      label: 'Memory notes',
      path: dataSources.memory.path,
      stats: `${dataSources.memory.dailyNotes} daily notes`,
      detail: dataSources.memory.latestDate ? `Latest note: ${dataSources.memory.latestDate}` : 'No dated memory notes yet.'
    },
    {
      label: 'Heartbeat archive',
      path: dataSources.history.path,
      stats: `${dataSources.history.archivedTasks} archived tasks`,
      detail: dataSources.history.latestCompletedOn ? `Latest completion: ${dataSources.history.latestCompletedOn}` : 'No archived tasks yet.'
    },
    {
      label: 'Skill tree',
      path: dataSources.skills.path,
      stats: `${dataSources.skills.skillCount} skills across ${dataSources.skills.categoryCount} categories`,
      detail: dataSources.skills.densestCategory ? `Top category: ${dataSources.skills.densestCategory}` : 'No skills discovered yet.'
    }
  ].map((surface) => `<div class="boundary-card"><strong>${surface.label}</strong><span>${surface.stats}</span><br><small>${surface.detail}</small><br><code>${surface.path}</code></div>`).join('')
  const visualizationPanels = [
    {
      label: 'Memory cadence',
      empty: 'No memory events to chart yet.',
      items: visualization.memoryByDay.map((entry) => ({
        key: entry.date,
        count: entry.count,
        detail: `${entry.count} events`
      }))
    },
    {
      label: 'History by task type',
      empty: 'No archived task types yet.',
      items: visualization.historyByType.map((entry) => ({
        key: entry.type,
        count: entry.count,
        detail: `${entry.count} archived items`
      }))
    },
    {
      label: 'Skill category density',
      empty: 'No skill categories to chart yet.',
      items: visualization.skillCategoryBreakdown.map((entry) => ({
        key: entry.category,
        count: entry.count,
        detail: `${entry.count} skills`
      }))
    }
  ].map((panel) => {
    const maxCount = panel.items.reduce((highest, entry) => Math.max(highest, entry.count), 0) || 1
    const rows = panel.items.length
      ? panel.items.map((entry) => {
        const width = Math.max(12, Math.round((entry.count / maxCount) * 100))
        return `<li><span>${entry.key}</span><div class="viz-bar"><strong style="width:${width}%"></strong></div><small>${entry.detail}</small></li>`
      }).join('')
      : `<li>${panel.empty}</li>`

    return `<section class="panel"><h2>${panel.label}</h2><ul class="viz-list">${rows}</ul></section>`
  }).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Hermes Agent Wrapper</title>
    <style>
      body { font-family: Inter, system-ui, sans-serif; margin: 0; background: #0b1020; color: #e8edf7; }
      main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 64px; }
      h1, h2, h3, p { margin-top: 0; }
      .grid { display: grid; gap: 16px; }
      .metrics { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: 24px; }
      .columns { grid-template-columns: 1.1fr 1fr 1fr; align-items: start; }
      .boundary { margin-bottom: 24px; }
      .boundary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
      .viz-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 24px; }
      .card, .panel, .group, .boundary-card { background: #121933; border: 1px solid #243053; border-radius: 16px; padding: 16px; }
      .card strong { display: block; font-size: 2rem; }
      .boundary-card strong { display: block; margin-bottom: 6px; }
      .card span, small { color: #aeb9d5; }
      code { color: #9fd0ff; word-break: break-all; }
      ul { padding-left: 18px; margin: 0; }
      li { margin-bottom: 12px; }
      .viz-list { list-style: none; padding-left: 0; }
      .viz-list li { display: grid; grid-template-columns: minmax(88px, auto) 1fr auto; gap: 10px; align-items: center; }
      .viz-bar { height: 10px; background: #0b1020; border: 1px solid #243053; border-radius: 999px; overflow: hidden; }
      .viz-bar strong { display: block; height: 100%; background: linear-gradient(90deg, #7c8cff, #37d0b0); border-radius: 999px; }
      @media (max-width: 900px) { .columns { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main>
      <h1>Hermes Agent Wrapper</h1>
      <p>MVP boundary: unify local memory notes, skill inventory, and archived heartbeat history into one inspectable wrapper snapshot.</p>
      <section class="grid metrics">${metricCards}</section>
      <section class="panel boundary">
        <h2>Wrapper boundary</h2>
        <div class="boundary-grid">
          <div class="boundary-card"><strong>${boundary.memory.activeDays} active memory days</strong><span>${boundarySources}</span></div>
          <div class="boundary-card"><strong>Recent shipped history</strong><span>${boundaryProjects}</span><br><small>${boundary.history.latestOutcome || 'No outcomes yet.'}</small></div>
          <div class="boundary-card"><strong>Skill density</strong><span>${boundaryCategories}</span><br><small>${boundary.skills.densestCategory ? `Top category: ${boundary.skills.densestCategory}` : 'No skills yet.'}</small></div>
        </div>
      </section>
      <section class="panel boundary">
        <h2>Wrapper surfaces</h2>
        <div class="boundary-grid">${wrapperSurfaceCards}</div>
      </section>
      <section class="grid viz-grid">${visualizationPanels}</section>
      <section class="grid columns">
        <div class="panel"><h2>Recent memory timeline</h2><ul>${timelineItems || '<li>No memory events found.</li>'}</ul></div>
        <div class="panel"><h2>Archived heartbeat history</h2><ul>${archivedItems || '<li>No archived tasks found.</li>'}</ul></div>
        <div class="panel"><h2>Skills by category</h2>${skillGroups || '<p>No skills found.</p>'}</div>
      </section>
    </main>
  </body>
</html>`
}

function requestHandler(request, response) {
  const snapshot = loadSnapshot()

  if (request.url === '/api/snapshot') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify(snapshot, null, 2))
    return
  }

  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  response.end(renderHtml(snapshot))
}

function startServer() {
  const server = http.createServer(requestHandler)
  server.listen(PORT, HOST, () => {
    console.log(`Hermes-Agent-Wrapper listening on http://${HOST}:${PORT}`)
  })
  return server
}

if (require.main === module) {
  startServer()
}

module.exports = {
  renderHtml,
  requestHandler,
  startServer
}
