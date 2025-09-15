const kDeps = [
  {
    name: "main",
    kind: "virtual",
    deps: [
      "shared-fluent",
      "content manager",
    ],
  },
  {
    name: "api daemon core",
    kind: "sharedWindowModule",
    param: ["js/api_daemon.js", "apiDaemon", "ApiDaemon"],
  },
  {
    name: "content manager",
    kind: "sharedWindowModule",
    param: ["js/content_manager.js", "contentManager", "ContentManager"],
    deps: ["api daemon core"],
  },
];



document.addEventListener('DOMContentLoaded', async () => {
  await depGraphLoaded;
  graph = new ParallelGraphLoader(addSharedDeps(addShoelaceDeps(kDeps)));
  await graph.waitForDeps("main");
  const renderArea = document.getElementById('markdown-render');
  const docTree = document.getElementById('doc-tree');
  const searchInput = document.getElementById('search-input');
  const contentContainer = document.getElementById('content');
  let allNodes = [];

  try {
    const response = await fetch('filelist.json');
    if (!response.ok) throw new Error('filelist.json 加载失败');
    const files = await response.json();

    buildTree(files, docTree);

    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      filterTree(term);
    });

  } catch (err) {
    docTree.innerHTML = `<li style="color: red; padding: 10px;">⚠️ ${err.message}</li>`;
    console.error(err);
  }

  function buildTree(items, parentElement) {
    items.forEach(item => {
      const li = document.createElement('li');

      if (item.type === 'directory') {
        const div = document.createElement('div');
        div.className = 'tree-item';
        div.dataset.path = '';

        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        toggle.textContent = '▶';
        div.appendChild(toggle);

        const title = document.createElement('span');
        title.textContent = beautifyName(item.name);
        div.appendChild(title);

        li.appendChild(div);

        const childUl = document.createElement('ul');
        childUl.className = 'tree-children';
        li.appendChild(childUl);

        buildTree(item.children, childUl);

        div.addEventListener('click', (e) => {
          if (e.target === toggle || e.target === div) {
            e.stopPropagation();
            toggleChildren(div);
          }
        });

      } else if (item.type === 'file') {

        const div = document.createElement('div');
        div.className = 'tree-item';
        div.dataset.file = item.path;

        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle empty';
        div.appendChild(toggle);

        const title = document.createElement('span');
        title.textContent = beautifyName(item.name.replace(/\.md$/, ''));
        div.appendChild(title);

        li.appendChild(div);

        div.addEventListener('click', () => {
          setActiveItem(div);
          loadMarkdown(item.path);
        });

        allNodes.push({ element: div, text: title.textContent });
      }

      parentElement.appendChild(li);
    });
  }

  function toggleChildren(itemElement) {
    const toggle = itemElement.querySelector('.tree-toggle');
    const children = itemElement.nextElementSibling;

    if (children && children.classList.contains('tree-children')) {
      const isShow = children.classList.toggle('show');
      toggle.textContent = isShow ? '▼' : '▶';
    }
  }

  function setActiveItem(item) {
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
    item.classList.add('active');
  }

  async function loadMarkdown(filePath) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) throw new Error(`加载失败: ${filePath}`);
      const text = await response.text();
      renderArea.innerHTML = marked.parse(text);
      contentContainer.scrollTop = 0;
    } catch (err) {
      renderArea.innerHTML = `<p style="color: red;">⚠️ ${err.message}</p>`;
    }
  }

  function beautifyName(name) {
    return name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function filterTree(term) {
    if (!term) {
      document.querySelectorAll('.tree-children').forEach(el => {
        el.classList.remove('search-hidden');
        if (!el.classList.contains('show')) {
          el.style.display = 'none';
        } else {
          el.style.display = 'block';
        }
      });
      document.querySelectorAll('.tree-item').forEach(el => {
        el.style.display = '';
      });
      return;
    }

    document.querySelectorAll('.tree-item').forEach(el => {
      el.style.display = 'none';
    });

    allNodes.forEach(({ element, text }) => {
      if (text.toLowerCase().includes(term)) {
        element.style.display = '';
        let parent = element.closest('li');
        while (parent) {
          const children = parent.querySelector('.tree-children');
          if (children) {
            children.classList.add('show');
            children.style.display = 'block';
            const toggle = parent.querySelector('.tree-toggle');
            if (toggle) toggle.textContent = '▼';
          }
          parent = parent.parentElement?.closest('li');
        }
      }
    });
  }
});