const { Client } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md');
const { markdownToBlocks } = require('@tryfabric/martian');
const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

// Initialize Notion client
const notion = new Client({ auth: 'API' }); // Replace with your Notion API key
const n2m = new NotionToMarkdown({ notionClient: notion });

// Configuration
const PROJECTS_DB_ID = 'PROJECTS_DB_ID';
const NOTES_DB_ID = 'NOTES_DB_ID';
const OBSIDIAN_VAULT_PATH = 'PATH';
const LAST_SYNC_FILE = 'last_sync.txt';

// Remove task-related content from Markdown
function removeTasks(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    console.warn('Warning: Markdown content is empty or invalid');
    return '';
  }
  return markdown.split('\n').filter(line => !line.match(/^\s*\[ \]|\[-]/)).join('\n');
}

// Transform single dollar sign equations to double dollar signs
function transformEquations(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    console.warn('Warning: Markdown content for equation transformation is empty or invalid');
    return markdown || '';
  }
  const inlineMathRegex = /(?<!\$)\$(.*?)(?<!\$)\$/g;
  return markdown.replace(inlineMathRegex, '$$$1$$');
}

// Convert Markdown to Notion blocks, handling inline and block equations separately
function convertMathToNotionBlocks(markdown) {
  console.log(`Converting Markdown to Notion blocks: '${markdown.slice(0, 50)}...'`);
  if (!markdown || typeof markdown !== 'string') {
    console.warn('Warning: Markdown content for block conversion is empty or invalid');
    return [];
  }

  const transformedMarkdown = transformEquations(markdown);
  console.log(`Transformed Markdown: '${transformedMarkdown.slice(0, 50)}...'`);

  const lines = transformedMarkdown.split('\n');
  const blocks = [];
  let inCodeBlock = false;
  let codeBlockContent = [];
  let codeBlockLanguage = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Handle code blocks
    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLanguage = trimmedLine.replace('```', '').trim() || 'plain text';
        codeBlockContent = [];
      } else {
        inCodeBlock = false;
        blocks.push({
          object: 'block',
          type: 'code',
          code: {
            rich_text: [{ type: 'text', text: { content: codeBlockContent.join('\n') } }],
            language: codeBlockLanguage,
          },
        });
        codeBlockContent = [];
        codeBlockLanguage = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Handle block equations (standalone $$...$$)
    const blockMathRegex = /^\$\$([\s\S]*?)\$\$$/;
    const blockMatch = trimmedLine.match(blockMathRegex);
    if (blockMatch) {
      const equation = blockMatch[1].trim();
      blocks.push({
        object: 'block',
        type: 'equation',
        equation: { expression: equation },
      });
      continue;
    }

    // Handle paragraphs, preserving inline equations as text
    if (trimmedLine) {
      const paragraphBlocks = markdownToBlocks(trimmedLine);
      // Ensure inline equations remain as text within paragraphs
      blocks.push(...paragraphBlocks);
    }
  }

  console.log('Generated Notion blocks:', JSON.stringify(blocks, null, 2));
  return blocks;
}

// Batch append blocks to avoid Notion API limits
async function appendBlocksInBatches(notionId, blocks) {
  const BATCH_SIZE = 50; // Notion API limit per request
  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    const batch = blocks.slice(i, i + BATCH_SIZE);
    try {
      await notion.blocks.children.append({
        block_id: notionId,
        children: batch,
      });
      console.log(`Appended batch ${i / BATCH_SIZE + 1} (${batch.length} blocks) to ${notionId}`);
    } catch (error) {
      console.error(`Failed to append batch ${i / BATCH_SIZE + 1}:`, error.message, error.stack);
      throw error; // Re-throw to halt syncing this file
    }
  }
}

// Sync from Notion to Obsidian
async function syncNotionToObsidian() {
  try {
    console.log('Starting Notion to Obsidian sync process...');
    const projects = await notion.databases.query({
      database_id: PROJECTS_DB_ID,
      filter: {
        and: [
          { property: 'Created', date: { on_or_after: '2025-05-13T00:00:00+03:00' } },
          { property: 'Tag', relation: { contains: 'TAG_ID' } },
        ],
      },
    });

    if (projects.results.length === 0) {
      console.log('No projects found to sync from Notion.');
      return;
    }

    console.log(`Found ${projects.results.length} projects to process.`);
    for (const project of projects.results) {
      const projectTitle = project.properties.Name.title[0]?.plain_text || 'Untitled';
      const projectFolder = path.join(OBSIDIAN_VAULT_PATH, projectTitle);
      console.log(`Now processing project: ${projectTitle}`);

      try {
        await fs.access(projectFolder);
        console.log(`Project folder '${projectTitle}' already exists.`);
      } catch {
        console.log(`Now syncing project '${projectTitle}' to Obsidian...`);
        await fs.mkdir(projectFolder, { recursive: true });
        console.log(`Project folder '${projectTitle}' created successfully.`);
      }

      console.log(`Fetching notes for project: ${projectTitle}`);
      const notes = await notion.databases.query({
        database_id: NOTES_DB_ID,
        filter: { property: 'Project', relation: { contains: project.id } },
      });

      console.log(`Found ${notes.results.length} notes for project: ${projectTitle}`);
      for (const note of notes.results) {
        const noteTitle = note.properties.Name.title[0]?.plain_text || 'Untitled';
        console.log(`Now syncing note '${noteTitle}' for project '${projectTitle}' (ID: ${note.id})...`);

        try {
          const markdown = await n2m.pageToMarkdown(note.id);
          const markdownString = n2m.toMarkdownString(markdown);
          let content = '';
          if (!markdownString || !markdownString.parent) {
            console.warn(`No Markdown content for note: ${noteTitle} (ID: ${note.id}). Creating with properties only...`);
          } else {
            content = removeTasks(markdownString.parent);
            if (!content.trim()) {
              console.warn(`Content is empty after processing for note: ${noteTitle} (ID: ${note.id}). Creating with properties only...`);
            }
          }

          const type = note.properties.Type?.select?.name || 'N/A';
          const created = note.created_time || 'N/A';
          const tags = note.properties.Tags?.multi_select?.map(tag => tag.name).join(', ') || 'N/A';
          let projectName = 'N/A';
          const projectId = note.properties.Project?.relation[0]?.id;
          if (projectId) {
            try {
              const projectPage = await notion.pages.retrieve({ page_id: projectId });
              projectName = projectPage.properties.Name?.title[0]?.plain_text || 'Untitled';
            } catch (error) {
              console.error(`Failed to fetch project name for ID ${projectId}:`, error);
            }
          }

          const frontmatter = `---
type: ${type}
created: ${created}
tags: ${tags}
project: ${projectName} [[${projectName}]]
notion_id: ${note.id}
---
`;
          const notePath = path.join(projectFolder, `${noteTitle}.md`);

          let existingContent = '';
          try {
            existingContent = await fs.readFile(notePath, 'utf8');
          } catch (e) {
            // File doesn't exist, proceed with new content
          }

          let finalContent = frontmatter + content;
          if (existingContent) {
            const existingFrontmatterEnd = existingContent.indexOf('---', existingContent.indexOf('---') + 1) + 3;
            const existingBody = existingContent.substring(existingFrontmatterEnd).trim();
            if (content && !existingBody.includes(content.trim())) {
              finalContent = existingContent.substring(0, existingFrontmatterEnd) + '\n\n' + content.trim() + '\n';
            } else {
              finalContent = existingContent;
            }
          }

          await fs.writeFile(notePath, finalContent);
          console.log(`Note '${noteTitle}' synced successfully to '${notePath}'.`);
        } catch (error) {
          console.error(`Failed to sync note '${noteTitle}' (ID: ${note.id}):`, error);
        }
      }
    }
    console.log('Notion to Obsidian sync process completed successfully.');
  } catch (error) {
    console.error('Notion to Obsidian sync failed:', error);
  }
}

// Sync from Obsidian to Notion
async function syncObsidianToNotion(lastSyncTime) {
  console.log('Starting Obsidian to Notion sync...');
  const mdFiles = await getAllMdFiles(OBSIDIAN_VAULT_PATH);
  console.log(`Found ${mdFiles.length} Markdown files.`);

  for (const filePath of mdFiles) {
    try {
      const stats = await fs.stat(filePath);
      if (stats.mtime <= new Date(lastSyncTime)) {
        console.log(`Skipping '${filePath}' (not modified since ${lastSyncTime}).`);
        continue;
      }

      console.log(`Processing '${filePath}' (Modified: ${stats.mtime})...`);
      const content = await fs.readFile(filePath, 'utf8');
      const frontmatterRegex = /^---\n(.*?)\n---\n/s;
      const match = content.match(frontmatterRegex);

      if (!match || !match[1]) {
        console.log(`No frontmatter in '${filePath}', skipping.`);
        continue;
      }

      const frontmatter = match[1];
      const notionId = frontmatter.split('\n').find(line => line.startsWith('notion_id:'))?.split(':')[1]?.trim();
      if (!notionId) {
        console.log(`No notion_id in '${filePath}', skipping.`);
        continue;
      }

      console.log(`Found notion_id: ${notionId}`);
      const markdownContent = content.replace(frontmatterRegex, '').trim();
      console.log(`Markdown content: '${markdownContent.slice(0, 50)}...'`);

      // Validate Notion page
      let page;
      try {
        page = await notion.pages.retrieve({ page_id: notionId });
        if (page.object !== 'page') {
          console.error(`ID ${notionId} is not a page, skipping.`);
          continue;
        }
        console.log(`Validated ${notionId} as a page.`);
      } catch (error) {
        console.error(`Invalid notion_id ${notionId}:`, error.message, error.stack);
        continue;
      }

      // List and clear existing blocks
      let currentBlocks = [];
      try {
        const { results } = await notion.blocks.children.list({ block_id: notionId });
        currentBlocks = results;
        console.log(`Found ${currentBlocks.length} existing blocks.`);
      } catch (error) {
        console.warn(`Failed to list blocks for ${notionId}:`, error.message, error.stack);
      }

      if (currentBlocks.length > 0) {
        for (const block of currentBlocks) {
          try {
            await notion.blocks.delete({ block_id: block.id });
            console.log(`Deleted block ${block.id}`);
          } catch (error) {
            console.error(`Failed to delete block ${block.id}:`, error.message, error.stack);
          }
        }
      }

      // Append new content
      if (markdownContent) {
        const blocks = convertMathToNotionBlocks(markdownContent);
        if (blocks.length > 0) {
          try {
            await appendBlocksInBatches(notionId, blocks);
            console.log(`Successfully appended all blocks to ${notionId}.`);
          } catch (error) {
            console.error(`Failed to append blocks to ${notionId}:`, error.message, error.stack);
            continue;
          }
        } else {
          console.log(`No blocks generated for '${filePath}'.`);
        }
      } else {
        console.log(`Empty content in '${filePath}', cleared ${notionId}.`);
      }
      console.log(`Synced '${filePath}' to Notion successfully.`);

    } catch (error) {
      console.error(`Error processing '${filePath}':`, error.message, error.stack);
    }
  }
  console.log('Obsidian to Notion sync completed.');
}

// Get all .md files
function getAllMdFiles(dir) {
  return new Promise((resolve, reject) => {
    try {
      const files = glob.sync('**/*.md', { cwd: dir });
      resolve(files.map(file => path.join(dir, file)));
    } catch (err) {
      reject(err);
    }
  });
}

// Main function
async function main() {
  console.log('Starting sync process...');
  let lastSyncTime;
  try {
    lastSyncTime = await fs.readFile(LAST_SYNC_FILE, 'utf8');
  } catch {
    lastSyncTime = '1970-01-01T00:00:00.000Z';
  }
  console.log(`Last sync: ${lastSyncTime}`);

  await syncObsidianToNotion(lastSyncTime);
  await syncNotionToObsidian();

  const currentTime = new Date().toISOString();
  await fs.writeFile(LAST_SYNC_FILE, currentTime);
  console.log(`Sync completed at ${currentTime}`);
}

main();
