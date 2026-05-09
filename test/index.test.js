const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  parseDailyMemoryMarkdown,
  parseArchivedHeartbeat,
  buildWrapperSnapshot
} = require('../src/index.js')
const { readMemoryEntries, loadSnapshot } = require('../src/data-sources.js')
const { renderHtml } = require('../src/server.js')

test('parseDailyMemoryMarkdown extracts timestamped memory events', () => {
  const entries = parseDailyMemoryMarkdown('- 06:00 heartbeat: built wrapper MVP\n- Updated HEARTBEAT.md: archived Hermes-Agent-Wrapper\n', '2026-04-15')

  assert.deepEqual(entries, [
    {
      date: '2026-04-15',
      time: '06:00',
      source: 'heartbeat',
      summary: 'built wrapper MVP'
    },
    {
      date: '2026-04-15',
      time: null,
      source: 'note',
      summary: 'Updated HEARTBEAT.md: archived Hermes-Agent-Wrapper'
    }
  ])
})

test('parseArchivedHeartbeat extracts archived task metadata', () => {
  const tasks = parseArchivedHeartbeat(`### Archived (上周完成)\n- [x] type=new_project project=Hermes-Agent-Wrapper source=#47 slice="Define the wrapper MVP boundary" | completed_on=2026-04-15 | verification="npm test (4 passed)" | outcome="Shipped dashboard MVP"\n`)

  assert.deepEqual(tasks, [
    {
      type: 'new_project',
      project: 'Hermes-Agent-Wrapper',
      source: '#47',
      slice: 'Define the wrapper MVP boundary',
      completed_on: '2026-04-15',
      verification: 'npm test (4 passed)',
      outcome: 'Shipped dashboard MVP'
    }
  ])
})

test('buildWrapperSnapshot groups memory, skills, and archived history for the dashboard', () => {
  const snapshot = buildWrapperSnapshot({
    memoryEntries: [
      { date: '2026-04-15', time: '06:00', source: 'heartbeat', summary: 'built wrapper MVP' },
      { date: '2026-04-14', time: '18:02', source: 'heartbeat', summary: 'revalidated MCPRegistry-Desktop export/import' },
      { date: '2026-04-14', time: '09:10', source: 'note', summary: 'captured wrapper notes' }
    ],
    archivedTasks: [
      {
        type: 'new_project',
        project: 'Hermes-Agent-Wrapper',
        source: '#47',
        slice: 'Define the wrapper MVP boundary',
        completed_on: '2026-04-15',
        verification: 'npm test (4 passed)',
        outcome: 'Shipped dashboard MVP'
      },
      {
        type: 'maintenance',
        project: 'Promptfoo-Desktop',
        source: 'maintenance:Promptfoo-Desktop',
        slice: 'Review workflow upgrades',
        completed_on: '2026-04-14',
        verification: 'npm test (340 passed)',
        outcome: 'Reviewed workflow upgrades'
      }
    ],
    skills: [
      { name: 'workspace-heartbeat-task-runner', category: 'software-development', description: 'Run heartbeat tasks safely' },
      { name: 'test-driven-development', category: 'software-development', description: 'Enforce red-green-refactor' }
    ]
  })

  assert.equal(snapshot.summary.totalMemoryEvents, 3)
  assert.equal(snapshot.summary.totalArchivedTasks, 2)
  assert.equal(snapshot.summary.totalSkills, 2)
  assert.equal(snapshot.summary.latestActivity.summary, 'built wrapper MVP')
  assert.deepEqual(snapshot.skillsByCategory, [
    {
      category: 'software-development',
      count: 2,
      skills: [
        { name: 'test-driven-development', description: 'Enforce red-green-refactor' },
        { name: 'workspace-heartbeat-task-runner', description: 'Run heartbeat tasks safely' }
      ]
    }
  ])
  assert.deepEqual(snapshot.boundary, {
    memory: {
      activeDays: 2,
      sources: [
        { source: 'heartbeat', count: 2 },
        { source: 'note', count: 1 }
      ]
    },
    history: {
      recentProjects: ['Hermes-Agent-Wrapper', 'Promptfoo-Desktop'],
      latestOutcome: 'Shipped dashboard MVP'
    },
    skills: {
      topCategories: [
        { category: 'software-development', count: 2 }
      ],
      densestCategory: 'software-development'
    }
  })
  assert.deepEqual(snapshot.visualization, {
    memoryByDay: [
      { date: '2026-04-15', count: 1 },
      { date: '2026-04-14', count: 2 }
    ],
    historyByType: [
      { type: 'maintenance', count: 1 },
      { type: 'new_project', count: 1 }
    ],
    skillCategoryBreakdown: [
      { category: 'software-development', count: 2 }
    ]
  })
})


test('renderHtml includes wrapper boundary highlights for memory, history, and skills', () => {
  const html = renderHtml({
    summary: {
      totalMemoryEvents: 2,
      totalArchivedTasks: 1,
      totalSkills: 2,
      latestActivity: { date: '2026-04-15', time: '06:00', source: 'heartbeat', summary: 'built wrapper MVP' }
    },
    timeline: [
      { date: '2026-04-15', time: '06:00', source: 'heartbeat', summary: 'built wrapper MVP' }
    ],
    archivedHistory: [
      { project: 'Hermes-Agent-Wrapper', completed_on: '2026-04-15', outcome: 'Shipped dashboard MVP', verification: 'npm test (4 passed)' }
    ],
    skillsByCategory: [
      {
        category: 'software-development',
        count: 2,
        skills: [
          { name: 'test-driven-development', description: 'Enforce red-green-refactor' },
          { name: 'workspace-heartbeat-task-runner', description: 'Run heartbeat tasks safely' }
        ]
      }
    ],
    boundary: {
      memory: {
        activeDays: 2,
        sources: [{ source: 'heartbeat', count: 2 }]
      },
      history: {
        recentProjects: ['Hermes-Agent-Wrapper'],
        latestOutcome: 'Shipped dashboard MVP'
      },
      skills: {
        topCategories: [{ category: 'software-development', count: 2 }],
        densestCategory: 'software-development'
      }
    },
    visualization: {
      memoryByDay: [{ date: '2026-04-15', count: 2 }],
      historyByType: [{ type: 'new_project', count: 1 }],
      skillCategoryBreakdown: [{ category: 'software-development', count: 2 }]
    }
  })

  assert.match(html, /Wrapper boundary/)
  assert.match(html, /Memory cadence/)
  assert.match(html, /History by task type/)
  assert.match(html, /2 active memory days/)
  assert.match(html, /software-development/) 
  assert.match(html, /Hermes-Agent-Wrapper/)
})

test('readMemoryEntries ignores non-daily markdown files in the memory directory', async () => {
  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hermes-wrapper-memory-'))

  try {
    await fs.promises.writeFile(path.join(tempRoot, '2026-04-16.md'), '- 03:06 heartbeat: shipped snapshot\n')
    await fs.promises.writeFile(path.join(tempRoot, 'agent-scheduler-design.md'), '- should not appear in timeline\n')

    const entries = readMemoryEntries(tempRoot)

    assert.deepEqual(entries, [
      {
        date: '2026-04-16',
        time: '03:06',
        source: 'heartbeat',
        summary: 'shipped snapshot'
      }
    ])
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true })
  }
})

test('buildWrapperSnapshot ranks densest skill categories first', () => {
  const snapshot = buildWrapperSnapshot({
    memoryEntries: [],
    archivedTasks: [],
    skills: [
      { name: 'alpha', category: 'software-development', description: 'a' },
      { name: 'beta', category: 'software-development', description: 'b' },
      { name: 'gamma', category: 'creative', description: 'c' },
      { name: 'delta', category: 'creative', description: 'd' },
      { name: 'epsilon', category: 'creative', description: 'e' }
    ]
  })

  assert.deepEqual(snapshot.boundary.skills.topCategories, [
    { category: 'creative', count: 3 },
    { category: 'software-development', count: 2 }
  ])
  assert.equal(snapshot.boundary.skills.densestCategory, 'creative')
})

test('readSkills supports category-level skills without counting references as fake skills', async () => {
  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hermes-wrapper-skills-'))

  try {
    const dogfoodDir = path.join(tempRoot, 'dogfood')
    await fs.promises.mkdir(path.join(dogfoodDir, 'references'), { recursive: true })
    await fs.promises.writeFile(path.join(dogfoodDir, 'SKILL.md'), 'description: "Dogfood QA"\n')
    await fs.promises.writeFile(path.join(dogfoodDir, 'references', 'note.md'), 'ignore me\n')

    const softwareDevelopmentDir = path.join(tempRoot, 'software-development', 'plan')
    await fs.promises.mkdir(softwareDevelopmentDir, { recursive: true })
    await fs.promises.writeFile(path.join(softwareDevelopmentDir, 'SKILL.md'), 'description: "Write plans"\n')

    const skills = require('../src/data-sources.js').readSkills(tempRoot)

    assert.deepEqual(skills, [
      { name: 'dogfood', category: 'dogfood', description: 'Dogfood QA' },
      { name: 'plan', category: 'software-development', description: 'Write plans' }
    ])
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true })
  }
})

test('loadSnapshot defaults to the active Hermes profile skill tree', async () => {
  const tempHome = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hermes-wrapper-home-'))
  const memoryDir = path.join(tempHome, 'workspace', 'memory')
  const heartbeatPath = path.join(tempHome, 'workspace', 'HEARTBEAT.md')
  const profileSkillsDir = path.join(tempHome, '.hermes', 'profiles', 'coder', 'skills', 'software-development', 'plan')
  const originalHome = process.env.HOME
  const originalUserProfile = process.env.HERMES_PROFILE

  try {
    await fs.promises.mkdir(memoryDir, { recursive: true })
    await fs.promises.mkdir(path.dirname(heartbeatPath), { recursive: true })
    await fs.promises.mkdir(profileSkillsDir, { recursive: true })
    await fs.promises.writeFile(path.join(memoryDir, '2026-04-25.md'), '- 06:30 heartbeat: inspected wrapper state\n')
    await fs.promises.writeFile(heartbeatPath, '- [x] type=new_project project=Hermes-Agent-Wrapper source=#47 slice="Define the wrapper MVP boundary" | completed_on=2026-04-25 | verification="npm test (7 passed)" | outcome="Shipped wrapper baseline"\n')
    await fs.promises.writeFile(path.join(profileSkillsDir, 'SKILL.md'), 'description: "Write plans"\n')

    process.env.HOME = tempHome
    process.env.HERMES_PROFILE = 'coder'

    const snapshot = loadSnapshot({
      workspaceRoot: path.join(tempHome, 'workspace')
    })

    assert.equal(snapshot.summary.totalSkills, 1)
    assert.equal(snapshot.skillsByCategory[0]?.category, 'software-development')
    assert.deepEqual(snapshot.skillsByCategory[0]?.skills, [
      { name: 'plan', description: 'Write plans' }
    ])
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = originalHome
    }

    if (originalUserProfile === undefined) {
      delete process.env.HERMES_PROFILE
    } else {
      process.env.HERMES_PROFILE = originalUserProfile
    }

    await fs.promises.rm(tempHome, { recursive: true, force: true })
  }
})

test('loadSnapshot exposes wrapper surface metadata for memory, heartbeat, and skills', async () => {
  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hermes-wrapper-sources-'))
  const memoryDir = path.join(tempRoot, 'memory')
  const heartbeatPath = path.join(tempRoot, 'HEARTBEAT.md')
  const skillsDir = path.join(tempRoot, 'skills', 'software-development', 'plan')

  try {
    await fs.promises.mkdir(memoryDir, { recursive: true })
    await fs.promises.mkdir(path.dirname(heartbeatPath), { recursive: true })
    await fs.promises.mkdir(skillsDir, { recursive: true })
    await fs.promises.writeFile(path.join(memoryDir, '2026-04-24.md'), '- 06:30 heartbeat: archived wrapper slice\n')
    await fs.promises.writeFile(path.join(memoryDir, '2026-04-26.md'), '- 07:10 heartbeat: refreshed wrapper surfaces\n')
    await fs.promises.writeFile(path.join(memoryDir, 'notes.md'), '- ignore me\n')
    await fs.promises.writeFile(heartbeatPath, '- [x] type=new_project project=Hermes-Agent-Wrapper source=#47 slice="Define the wrapper MVP boundary" | completed_on=2026-04-24 | verification="npm test (8 passed)" | outcome="Shipped wrapper surface catalog"\n')
    await fs.promises.writeFile(path.join(skillsDir, 'SKILL.md'), 'description: "Write plans"\n')

    const snapshot = loadSnapshot({
      workspaceRoot: tempRoot,
      memoryDirectoryPath: memoryDir,
      heartbeatPath,
      skillsRootPath: path.join(tempRoot, 'skills')
    })

    assert.deepEqual(snapshot.dataSources, {
      memory: {
        path: memoryDir,
        dailyNotes: 2,
        latestDate: '2026-04-26'
      },
      history: {
        path: heartbeatPath,
        archivedTasks: 1,
        latestCompletedOn: '2026-04-24'
      },
      skills: {
        path: path.join(tempRoot, 'skills'),
        skillCount: 1,
        categoryCount: 1,
        densestCategory: 'software-development'
      }
    })
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true })
  }
})

test('renderHtml shows the wrapper surface catalog next to the boundary summary', () => {
  const html = renderHtml({
    summary: {
      totalMemoryEvents: 2,
      totalArchivedTasks: 1,
      totalSkills: 2,
      latestActivity: { date: '2026-04-15', time: '06:00', source: 'heartbeat', summary: 'built wrapper MVP' }
    },
    timeline: [],
    archivedHistory: [],
    skillsByCategory: [],
    boundary: {
      memory: { activeDays: 2, sources: [{ source: 'heartbeat', count: 2 }] },
      history: { recentProjects: ['Hermes-Agent-Wrapper'], latestOutcome: 'Shipped dashboard MVP' },
      skills: { topCategories: [{ category: 'software-development', count: 2 }], densestCategory: 'software-development' }
    },
    dataSources: {
      memory: { path: '/tmp/workspace/memory', dailyNotes: 2, latestDate: '2026-04-15' },
      history: { path: '/tmp/workspace/HEARTBEAT.md', archivedTasks: 1, latestCompletedOn: '2026-04-15' },
      skills: { path: '/tmp/.hermes/skills', skillCount: 2, categoryCount: 1, densestCategory: 'software-development' }
    }
  })

  assert.match(html, /Wrapper surfaces/)
  assert.match(html, /\/tmp\/workspace\/memory/)
  assert.match(html, /1 archived tasks/)
  assert.match(html, /software-development/) 
})
