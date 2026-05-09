const DAILY_MEMORY_LINE_PATTERN = /^-\s+(?:(\d{2}:\d{2})\s+([^:]+):\s+)?(.+)$/
const ARCHIVED_TASK_PATTERN = /^- \[x\] type=(\S+) project=(\S+) source=(\S+) slice="([^"]+)" \| completed_on=([^|]+) \| verification="([^"]*)" \| outcome="([^"]*)"$/

function parseDailyMemoryMarkdown(markdown, date) {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(DAILY_MEMORY_LINE_PATTERN)
      if (!match) {
        return null
      }

      const [, time, source, summary] = match

      return {
        date,
        time: time || null,
        source: source ? source.trim() : 'note',
        summary: summary.trim()
      }
    })
    .filter(Boolean)
}

function parseArchivedHeartbeat(markdown) {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- [x] type='))
    .map((line) => {
      const match = line.match(ARCHIVED_TASK_PATTERN)
      if (!match) {
        return null
      }

      const [, type, project, source, slice, completedOn, verification, outcome] = match
      return {
        type,
        project,
        source,
        slice,
        completed_on: completedOn.trim(),
        verification,
        outcome
      }
    })
    .filter(Boolean)
}

function sortMemoryEntries(memoryEntries) {
  return [...memoryEntries].sort((left, right) => {
    const leftKey = `${left.date} ${left.time || '00:00'}`
    const rightKey = `${right.date} ${right.time || '00:00'}`
    return rightKey.localeCompare(leftKey)
  })
}

function summarizeBoundary(memoryEntries, archivedTasks, skillsByCategory) {
  const activeDays = new Set(memoryEntries.map((entry) => entry.date)).size
  const memorySources = [...memoryEntries.reduce((sourceCounts, entry) => {
    sourceCounts.set(entry.source, (sourceCounts.get(entry.source) || 0) + 1)
    return sourceCounts
  }, new Map()).entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([source, count]) => ({ source, count }))

  const topCategories = skillsByCategory
    .map((group) => ({ category: group.category, count: group.count }))
    .slice(0, 3)

  const recentProjects = [...new Set(archivedTasks.map((task) => task.project))].slice(0, 3)

  return {
    memory: {
      activeDays,
      sources: memorySources
    },
    history: {
      recentProjects,
      latestOutcome: archivedTasks[0]?.outcome || null
    },
    skills: {
      topCategories,
      densestCategory: topCategories[0]?.category || null
    }
  }
}

function buildVisualization(memoryEntries, archivedTasks, skillsByCategory) {
  const memoryByDay = [...memoryEntries.reduce((dayCounts, entry) => {
    dayCounts.set(entry.date, (dayCounts.get(entry.date) || 0) + 1)
    return dayCounts
  }, new Map()).entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, 7)
    .map(([date, count]) => ({ date, count }))

  const historyByType = [...archivedTasks.reduce((typeCounts, task) => {
    typeCounts.set(task.type, (typeCounts.get(task.type) || 0) + 1)
    return typeCounts
  }, new Map()).entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([type, count]) => ({ type, count }))

  const skillCategoryBreakdown = skillsByCategory
    .slice(0, 6)
    .map((group) => ({
      category: group.category,
      count: group.count
    }))

  return {
    memoryByDay,
    historyByType,
    skillCategoryBreakdown
  }
}

function buildWrapperSnapshot({ memoryEntries, archivedTasks, skills }) {
  const sortedMemoryEntries = sortMemoryEntries(memoryEntries)

  const skillsByCategoryMap = new Map()
  for (const skill of skills) {
    const category = skill.category || 'uncategorized'
    if (!skillsByCategoryMap.has(category)) {
      skillsByCategoryMap.set(category, [])
    }
    skillsByCategoryMap.get(category).push({
      name: skill.name,
      description: skill.description || ''
    })
  }

  const skillsByCategory = [...skillsByCategoryMap.entries()]
    .map(([category, groupedSkills]) => ({
      category,
      count: groupedSkills.length,
      skills: groupedSkills.sort((left, right) => left.name.localeCompare(right.name))
    }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category))

  return {
    summary: {
      totalMemoryEvents: sortedMemoryEntries.length,
      totalArchivedTasks: archivedTasks.length,
      totalSkills: skills.length,
      latestActivity: sortedMemoryEntries[0] || null
    },
    timeline: sortedMemoryEntries.slice(0, 12),
    archivedHistory: [...archivedTasks].sort((left, right) => right.completed_on.localeCompare(left.completed_on)),
    skillsByCategory,
    boundary: summarizeBoundary(sortedMemoryEntries, archivedTasks, skillsByCategory),
    visualization: buildVisualization(sortedMemoryEntries, archivedTasks, skillsByCategory)
  }
}

module.exports = {
  parseDailyMemoryMarkdown,
  parseArchivedHeartbeat,
  buildWrapperSnapshot,
  buildVisualization,
  sortMemoryEntries,
  summarizeBoundary
}
