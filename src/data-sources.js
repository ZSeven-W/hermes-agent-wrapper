const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const {
  parseDailyMemoryMarkdown,
  parseArchivedHeartbeat,
  buildWrapperSnapshot
} = require('./index.js')

function listMarkdownFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return []
  }

  return fs.readdirSync(directoryPath)
    .filter((entry) => /^\d{4}-\d{2}-\d{2}\.md$/.test(entry))
    .sort()
}

function readMemoryEntries(memoryDirectoryPath) {
  return listMarkdownFiles(memoryDirectoryPath)
    .flatMap((fileName) => {
      const filePath = path.join(memoryDirectoryPath, fileName)
      const markdown = fs.readFileSync(filePath, 'utf8')
      const date = fileName.replace(/\.md$/, '')
      return parseDailyMemoryMarkdown(markdown, date)
    })
}

function readArchivedTasks(heartbeatPath) {
  if (!fs.existsSync(heartbeatPath)) {
    return []
  }

  return parseArchivedHeartbeat(fs.readFileSync(heartbeatPath, 'utf8'))
}

function readSkillDescription(skillFilePath) {
  if (!fs.existsSync(skillFilePath)) {
    return ''
  }

  const markdown = fs.readFileSync(skillFilePath, 'utf8')
  const descriptionLine = markdown.split('\n').find((line) => line.startsWith('description:'))
  if (!descriptionLine) {
    return ''
  }

  return descriptionLine.replace(/^description:\s*/, '').replace(/^"|"$/g, '')
}

function readSkills(skillsRootPath) {
  if (!fs.existsSync(skillsRootPath)) {
    return []
  }

  const categories = fs.readdirSync(skillsRootPath, { withFileTypes: true })
  const skillRecords = []

  for (const categoryEntry of categories) {
    if (!categoryEntry.isDirectory()) {
      continue
    }

    const categoryPath = path.join(skillsRootPath, categoryEntry.name)
    const categorySkillPath = path.join(categoryPath, 'SKILL.md')

    if (fs.existsSync(categorySkillPath)) {
      skillRecords.push({
        name: categoryEntry.name,
        category: categoryEntry.name,
        description: readSkillDescription(categorySkillPath)
      })
      continue
    }

    const skillDirs = fs.readdirSync(categoryPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())

    for (const skillDir of skillDirs) {
      const skillFilePath = path.join(categoryPath, skillDir.name, 'SKILL.md')
      if (!fs.existsSync(skillFilePath)) {
        continue
      }

      skillRecords.push({
        name: skillDir.name,
        category: categoryEntry.name,
        description: readSkillDescription(skillFilePath)
      })
    }
  }

  return skillRecords.sort((left, right) => {
    const categoryComparison = left.category.localeCompare(right.category)
    return categoryComparison || left.name.localeCompare(right.name)
  })
}

function resolveDefaultSkillsRootPath() {
  const hermesHome = path.join(os.homedir(), '.hermes')
  const activeProfile = process.env.HERMES_PROFILE || 'coder'
  const profileSkillsPath = path.join(hermesHome, 'profiles', activeProfile, 'skills')

  if (fs.existsSync(profileSkillsPath)) {
    return profileSkillsPath
  }

  return path.join(hermesHome, 'skills')
}

function buildDataSourcesMetadata({ memoryDirectoryPath, heartbeatPath, skillsRootPath, memoryEntries, archivedTasks, skills, snapshot }) {
  const dailyNotes = listMarkdownFiles(memoryDirectoryPath)
  const latestMemoryDate = memoryEntries.reduce((latest, entry) => {
    if (!latest || entry.date > latest) {
      return entry.date
    }
    return latest
  }, null)

  return {
    memory: {
      path: memoryDirectoryPath,
      dailyNotes: dailyNotes.length,
      latestDate: latestMemoryDate
    },
    history: {
      path: heartbeatPath,
      archivedTasks: archivedTasks.length,
      latestCompletedOn: snapshot.archivedHistory[0]?.completed_on || null
    },
    skills: {
      path: skillsRootPath,
      skillCount: skills.length,
      categoryCount: snapshot.skillsByCategory.length,
      densestCategory: snapshot.boundary.skills.densestCategory || null
    }
  }
}

function loadSnapshot(options = {}) {
  const workspaceRoot = options.workspaceRoot || path.resolve(__dirname, '..', '..')
  const memoryDirectoryPath = options.memoryDirectoryPath || path.join(workspaceRoot, 'memory')
  const heartbeatPath = options.heartbeatPath || path.join(workspaceRoot, 'HEARTBEAT.md')
  const skillsRootPath = options.skillsRootPath || resolveDefaultSkillsRootPath()
  const memoryEntries = readMemoryEntries(memoryDirectoryPath)
  const archivedTasks = readArchivedTasks(heartbeatPath)
  const skills = readSkills(skillsRootPath)

  const snapshot = buildWrapperSnapshot({
    memoryEntries,
    archivedTasks,
    skills
  })

  return {
    ...snapshot,
    dataSources: buildDataSourcesMetadata({
      memoryDirectoryPath,
      heartbeatPath,
      skillsRootPath,
      memoryEntries,
      archivedTasks,
      skills,
      snapshot
    })
  }
}

module.exports = {
  loadSnapshot,
  readMemoryEntries,
  readArchivedTasks,
  readSkills,
  buildDataSourcesMetadata
}
