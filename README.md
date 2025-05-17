# Notion-Obsidian Sync

A robust bidirectional synchronization tool for Notion and Obsidian notes, meticulously designed to handle complex content such as Markdown, equations, and code blocks. This project bridges the gap between Notion’s collaborative power and Obsidian’s local Markdown flexibility, making it an invaluable asset for students, researchers, developers, and professionals managing knowledge across platforms.

## Features
- **Bidirectional Synchronization**: Seamlessly syncs notes between Notion and Obsidian, ensuring consistency across both ecosystems.
- **Advanced Content Support**: Handles inline and block equations (e.g., `$$y$$` and `$$\mu_k = \frac{1}{|C_k|} \sum_{i \in C_k} x^{(i)}$$`) and code blocks with syntax highlighting (e.g., Python snippets).
- **Robust Error Handling**: Implements detailed logging and batch processing to manage Notion API limits and resolve sync failures effectively.
- **Flexible Integration**: Supports custom Notion database IDs and Obsidian vault paths for tailored workflows.

## Development Journey and Enhancements
This project evolved through rigorous debugging and iterative improvements, reflecting a commitment to quality and user needs:

- **Initial Build**: Started as a basic script to sync Markdown notes bidirectionally, leveraging the Notion API and Obsidian’s file system.
- **Equation Handling**: Overcame challenges with equation formatting by transforming single-dollar equations (`$...$`) to double-dollar (`$$...$$`) for Notion compatibility, distinguishing inline from block equations to ensure proper rendering.
- **Code Block Support**: Added precise parsing and rendering of code blocks, preserving indentation and supporting languages like Python, addressing initial failures in sync accuracy.
- **Error Resolution**: Tackled sync failures with enhanced error logging, batch block appending (up to 50 blocks per request), and validation of Notion page IDs, ensuring reliability even with complex content.
- **Performance Optimization**: Introduced batch processing to handle Notion API rate limits and optimized block generation to prevent timeouts or crashes.
- **Testing and Refinement**: Extensively tested with real-world examples (e.g., K-means clustering notes with formulas and code), iteratively fixing issues based on detailed logs and user feedback.

These enhancements showcase problem-solving skills, attention to detail, and the ability to adapt to technical challenges, making this a standout project.

## Detailed Benefits
- **Cross-Platform Workflow**: Maintains a unified note-taking experience, ideal for users switching between Notion’s web interface and Obsidian’s local environment.
- **Technical Versatility**: Perfect for engineers, data scientists, and academics syncing technical documents with equations and code, enhancing productivity in fields like machine learning and research.
- **Reliability and Scalability**: Handles large notes and complex structures with batch processing and error recovery, ensuring data integrity over time.

## Usage
### Installation
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/TheRock87/notion-obsidian-sync.git
   cd notion-obsidian-sync
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Customize Paths**:
   - Edit `notion-to-obsidian-sync.js` to update:
     - `OBSIDIAN_VAULT_PATH`: Path to your Obsidian vault (e.g., `/Obsidian/Note Taking System/Learning Journey Notes`).
     - `PROJECTS_DB_ID` and `NOTES_DB_ID`: Your Notion database IDs.
     - `LAST_SYNC_FILE`: Path for the sync timestamp file.

### Running the Script
- **Start the Sync**:
  ```bash
  npm start
  ```
- **Monitor Output**: Check the console for detailed logs, including sync status and any errors, saved to `sync.log` if redirected (e.g., `npm start > sync.log 2>&1`).

### Example
Sync a note like this:
```
---
notion_id: your-page-id
---
### Unsupervised Learning Overview
Unsupervised learning lacks labels ($$y$$).
#### K-means Clustering
Cluster means: $$\mu_k = \frac{1}{|C_k|} \sum_{i \in C_k} x^{(i)}$$
#### Code Example
```python
def find_closest_centroids(X, centroids):
    idx = np.zeros(X.shape[0], dtype=int)
    for j in range(X.shape[0]):
        least = float('inf')
        for i in range(centroids.shape[0]):
            dis = np.linalg.norm(X[j] - centroids[i])
            if dis < least:
                least = dis
                idx[j] = i
    return idx
```

- **Obsidian**: Preserves the original Markdown.
- **Notion**: Renders headers, inline equations as text, block equations as math blocks, and code with syntax highlighting.

## Contributing
Contributions are welcome! Open an issue or submit a pull request to enhance features, fix bugs, or add support for new content types.


## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact
- **GitHub**: [TheRock87](https://github.com/TheRock87)
- **Email**: hossam.kharbotly@gmail.com
